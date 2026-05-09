import type { Prisma, PrismaClient, StageType, SplitType, JoinType } from '@prisma/client';
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

  // ─── PASS 1: stages + actions ─────────────────────────────────────────
  const stageByNodeId = new Map<string, { id: string; nodeType: string }>();
  let initialStageSeen = false;

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

    const stage = await tx.workflowStage.create({
      data: {
        workflowId,
        name: node.data.label,
        canonicalId: node.id,
        isInitialStage: isInitial,
        position: node.position as unknown as Prisma.InputJsonValue,
        sendEmail: node.data.basic_details?.email_notification === true,
        additionalData: additionalData as Prisma.InputJsonValue | undefined,
        stageType,
        splitType,
        joinType,
      },
      select: { id: true },
    });

    stageByNodeId.set(node.id, { id: stage.id, nodeType });

    // Actions — primary + secondary, with `secondary` flag derived from `type`
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

      const roleIds = toIdList(a.roles_id);
      const userIds = toIdList(a.employees_id);

      await tx.workflowStageAction.create({
        data: {
          workflowStageId: stage.id,
          workflowActionId: a.stage_status_id,
          criteriaId: a.action_criteria_id ?? defaultCriteriaId ?? null,
          isPrimary,
          allowedRoles: roleIds.length
            ? { connect: roleIds.map((id) => ({ id })) }
            : undefined,
          allowedUsers: userIds.length
            ? { connect: userIds.map((id) => ({ id })) }
            : undefined,
        },
      });
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

  // ─── PASS 2: fork → join wiring ───────────────────────────────────────
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
    await tx.workflowStage.update({
      where: { id: fork.id },
      data: { joinPointId: join.id },
    });
  }

  // ─── PASS 3: transitions ──────────────────────────────────────────────
  for (let idx = 0; idx < edges.length; idx++) {
    const edge = edges[idx]!;
    const from = stageByNodeId.get(edge.source);
    const to = stageByNodeId.get(edge.target);
    if (!from || !to) {
      throw BadRequest(
        `Transition references unknown stage(s): ${edge.source} → ${edge.target}`
      );
    }
    await tx.workflowTransition.create({
      data: {
        workflowId,
        fromStageId: from.id,
        toStageId: to.id,
        sourcePort: edge.sourceHandle ?? null,
        targetPort: edge.targetHandle ?? null,
        branchName: edge.branchInfo?.branchName ?? edge.label ?? null,
        condition: edge.branchInfo?.condition ?? null,
        branchOrder: edge.branchInfo?.order ?? idx,
      },
    });
  }

  return { warnings };
};

