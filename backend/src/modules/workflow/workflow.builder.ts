import { Prisma, type PrismaClient, type StageType, type SplitType, type JoinType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { BadRequest } from '../../lib/httpError';
import type { WorkflowEdge, WorkflowNode, WorkflowSettings } from './workflow.schema';

type Tx = Prisma.TransactionClient | PrismaClient;

const NODE_TYPE_TO_STAGE_TYPE: Record<string, StageType> = {
  stage: 'STAGE',
  fork: 'FORK',
  join: 'JOIN',
  decision: 'DECISION',
  audit_forms: 'AUDIT_FORMS',
};

const getNodeType = (node: WorkflowNode): string =>
  node.type ?? node.data.nodeType ?? 'stage';

const stripWorkflowTypesKey = (data: Record<string, unknown> | undefined) => {
  if (!data) return undefined;
  const { workflow_types: _ignored, ...rest } = data;
  return rest;
};

/**
 * Convert role identifiers from frontend payload to UUID strings.
 * Accepts: bare UUID strings, or { value: UUID }, or { id: UUID } objects.
 */
const toIdList = (input: unknown[] | undefined): string[] => {
  if (!input || input.length === 0) return [];
  const out: string[] = [];
  for (const item of input) {
    if (!item) continue;
    if (typeof item === 'string') {
      out.push(item);
    } else if (typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const id = (obj.value ?? obj.id) as string | undefined;
      if (id && typeof id === 'string') out.push(id);
    }
  }
  return out;
};

export interface BuilderResult {
  warnings: string[];
}

export const applyWorkflowSettings = async (
  tx: Tx,
  workflowId: string,
  settings: WorkflowSettings | undefined
): Promise<void> => {
  if (!settings) return;
  const data: Prisma.WorkflowUpdateInput = {};
  if (settings.maxExecutionsPerDay !== undefined)
    data.maxExecutionsPerDay = settings.maxExecutionsPerDay;
  if (settings.timeoutSeconds !== undefined)
    data.timeoutSeconds = settings.timeoutSeconds;
  if (settings.workflowStatus !== undefined)
    data.workflowStatus = settings.workflowStatus;
  if (Object.keys(data).length === 0) return;
  await tx.workflow.update({ where: { id: workflowId }, data });
};

/**
 * Build a workflow's stages, actions, fork/join wiring, and transitions.
 *
 * Caller must already hold a transaction. The target workflow must exist
 * and have **no existing stages** — caller is responsible for cloning into
 * a fresh version row when versioning.
 */
export const buildWorkflowGraph = async (
  tx: Tx,
  workflowId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options: { defaultCriteriaId?: string } = {}
): Promise<BuilderResult> => {
  const warnings: string[] = [];

  const existing = await tx.workflowStage.count({ where: { workflowId } });
  if (existing > 0) {
    throw BadRequest(
      'Workflow already has stages — caller must clone into a new version row first'
    );
  }

  // Resolve default ActionCriteria ("Anyone") if not provided
  let defaultCriteriaId = options.defaultCriteriaId;
  if (!defaultCriteriaId) {
    const anyone = await tx.actionCriteria.findFirst({ where: { name: 'Anyone' } });
    defaultCriteriaId = anyone?.id;
  }

  // ─── BUILD PHASE — collect every row in memory, no DB calls yet ───────
  //
  // Pre-generating UUIDs lets us use Prisma `createMany` (which doesn't return
  // generated IDs) for the bulk inserts. Postgres accepts any RFC4122 v4 UUID
  // for a `String @id @default(uuid())` column, so this is safe.
  const stageByNodeId = new Map<string, { id: string; nodeType: string }>();
  const stageRows: Prisma.WorkflowStageCreateManyInput[] = [];
  const actionRows: Prisma.WorkflowStageActionCreateManyInput[] = [];
  const roleConnects: { actionId: string; roleId: string }[] = [];
  const userConnects: { actionId: string; userId: string }[] = [];
  const forkUpdates: { stageId: string; joinPointId: string }[] = [];
  const transitionRows: Prisma.WorkflowTransitionCreateManyInput[] = [];

  let initialStageSeen = false;

  // Pass 1 (in-memory): build stage + action rows
  for (const node of nodes) {
    const isInitial = node.data.basic_details?.is_initial_stage === true;
    if (isInitial) {
      if (initialStageSeen) {
        throw BadRequest('Only one initial stage is allowed');
      }
      initialStageSeen = true;
    }

    const nodeType = getNodeType(node);
    const stageType: StageType = NODE_TYPE_TO_STAGE_TYPE[nodeType] ?? 'STAGE';
    const cfg = node.data.parallelConfig;
    const splitType = (cfg?.splitType ?? null) as SplitType | null;
    const joinType = (cfg?.joinType ?? null) as JoinType | null;
    const additionalData = stripWorkflowTypesKey(node.data.additional_data);

    const stageId = randomUUID();
    stageRows.push({
      id: stageId,
      workflowId,
      name: node.data.label,
      canonicalId: node.id,
      isInitialStage: isInitial,
      sendEmail: node.data.basic_details?.email_notification === true,
      additionalData: additionalData as Prisma.InputJsonValue | undefined,
      stageType,
      splitType,
      joinType,
    });
    stageByNodeId.set(node.id, { id: stageId, nodeType });

    const primary = node.data.primary_actions ?? [];
    const secondary = (node.data.secondary_actions ?? []).map((a) => ({
      ...(a as object),
      type: (a as { type?: string }).type ?? 'secondary',
    }));
    const allActions = [...primary, ...secondary];

    for (const action of allActions) {
      const a = action as {
        type?: string;
        stage_status_id: string;
        action_criteria_id?: string | null;
        roles_id?: unknown[];
        employees_id?: unknown[];
      };
      const isPrimary = (a.type ?? 'primary') !== 'secondary';

      const actionId = randomUUID();
      actionRows.push({
        id: actionId,
        workflowStageId: stageId,
        workflowActionId: a.stage_status_id,
        criteriaId: a.action_criteria_id ?? defaultCriteriaId ?? null,
        isPrimary,
      });

      for (const roleId of toIdList(a.roles_id)) roleConnects.push({ actionId, roleId });
      for (const userId of toIdList(a.employees_id)) userConnects.push({ actionId, userId });
    }

    // Phase 1: silently warn if forms / sla / dependency / child triggers / form rules present
    if ((node.data.forms ?? []).length > 0)
      warnings.push(`Stage '${node.data.label}': forms binding deferred to Forms phase`);
    if ((node.data.sla ?? []).length > 0)
      warnings.push(`Stage '${node.data.label}': SLA configuration deferred to SLA phase`);
    if ((node.data.dependency ?? []).length > 0)
      warnings.push(`Stage '${node.data.label}': dependencies deferred to Engine phase`);
    if ((node.data.child_workflow_triggers ?? []).length > 0)
      warnings.push(
        `Stage '${node.data.label}': child workflow triggers deferred to Engine phase`
      );
    if ((node.data.form_visibility_rules ?? []).length > 0)
      warnings.push(
        `Stage '${node.data.label}': cross-stage form rules deferred to Forms phase`
      );
  }

  // Pass 2 (in-memory): fork → join validation + collect updates
  for (const node of nodes) {
    if (getNodeType(node) !== 'fork') continue;
    const fork = stageByNodeId.get(node.id);
    if (!fork) continue;
    const joinNodeId = node.data.parallelConfig?.joinStageId;
    if (!joinNodeId) continue;
    const join = stageByNodeId.get(joinNodeId);
    if (!join) {
      throw BadRequest(
        `Fork '${node.data.label}' references unknown join stage '${joinNodeId}'`
      );
    }
    if (join.nodeType !== 'join') {
      throw BadRequest(
        `Fork '${node.data.label}' references stage '${joinNodeId}' that is not a join node`
      );
    }
    forkUpdates.push({ stageId: fork.id, joinPointId: join.id });
  }

  // Pass 3 (in-memory): transition rows
  for (let idx = 0; idx < edges.length; idx++) {
    const edge = edges[idx]!;
    const from = stageByNodeId.get(edge.source);
    const to = stageByNodeId.get(edge.target);
    if (!from || !to) {
      throw BadRequest(
        `Transition references unknown stage(s): ${edge.source} → ${edge.target}`
      );
    }
    transitionRows.push({
      id: randomUUID(),
      workflowId,
      fromStageId: from.id,
      toStageId: to.id,
      sourcePort: edge.sourceHandle ?? null,
      targetPort: edge.targetHandle ?? null,
      branchName: edge.branchInfo?.branchName ?? edge.label ?? null,
      condition: edge.branchInfo?.condition ?? null,
      branchOrder: edge.branchInfo?.order ?? idx,
    });
  }

  // ─── EXECUTE PHASE — at most ~6 round-trips regardless of graph size ──
  if (stageRows.length > 0) {
    await tx.workflowStage.createMany({ data: stageRows });
  }

  if (actionRows.length > 0) {
    await tx.workflowStageAction.createMany({ data: actionRows });
  }

  // Bulk-insert into the implicit m2m join tables. Table/column names match
  // the migration in 20260508112732_workflow_phase1: `_StageActionAllowedRoles`
  // (A=Role.id, B=WorkflowStageAction.id) and `_StageActionAllowedUsers`
  // (A=User.id, B=WorkflowStageAction.id).
  if (roleConnects.length > 0) {
    const values = roleConnects.map((c) => Prisma.sql`(${c.roleId}, ${c.actionId})`);
    await tx.$executeRaw`INSERT INTO "_StageActionAllowedRoles" ("A", "B") VALUES ${Prisma.join(values)}`;
  }
  if (userConnects.length > 0) {
    const values = userConnects.map((c) => Prisma.sql`(${c.userId}, ${c.actionId})`);
    await tx.$executeRaw`INSERT INTO "_StageActionAllowedUsers" ("A", "B") VALUES ${Prisma.join(values)}`;
  }

  // Fork updates fan out in parallel — Prisma pipelines them on the same
  // transaction connection, so wall-clock cost is ~1 round-trip total.
  if (forkUpdates.length > 0) {
    await Promise.all(
      forkUpdates.map((f) =>
        tx.workflowStage.update({
          where: { id: f.stageId },
          data: { joinPointId: f.joinPointId },
        }),
      ),
    );
  }

  if (transitionRows.length > 0) {
    await tx.workflowTransition.createMany({ data: transitionRows });
  }

  return { warnings };
};

