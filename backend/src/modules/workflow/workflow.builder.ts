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

  // Phase 3.5+ — collect embedded policy intent for materialisation after the
  // base stage/action rows are inserted. See workflow.schema.ts for the
  // canonical shapes (`EmbeddedFormBinding`, `EmbeddedSla`, `EmbeddedApprovalPolicy`).
  //
  // Approval policies key by (actionType, actionIndex) within a stage node;
  // we resolve them to action UUIDs via this map populated alongside action
  // row creation.
  const actionIdByRef = new Map<string, string>(); // `${stageId}:${type}:${index}` → actionId
  // Form bindings carry M2M access lists (fill/view roles+users) which
  // createMany can't connect, so we defer to per-row `create` after the bulk
  // stage insert — same pattern as approval policies below.
  type PendingFormBinding = {
    stageId: string;
    stageLabel: string;
    data: import('./workflow.schema').EmbeddedFormBinding;
  };
  const pendingFormBindings: PendingFormBinding[] = [];
  // SLA + thresholds + responsible/notify M2M are inserted per-stage after the
  // bulk create because the policy id needs to exist before threshold inserts.
  type PendingSla = {
    stageId: string;
    data: import('./workflow.schema').EmbeddedSla;
  };
  const pendingSlaPolicies: PendingSla[] = [];
  type PendingApproval = {
    stageId: string;
    actionRef: string; // matches actionIdByRef key
    data: import('./workflow.schema').EmbeddedApprovalPolicy;
  };
  const pendingApprovalPolicies: PendingApproval[] = [];
  // Child-workflow triggers — one ChildWorkflowTrigger row per entry. Materialised
  // after the bulk stage insert; the referenced childWorkflowId is validated then
  // (FK is onDelete: Restrict, so a stale id would abort the whole tx).
  type PendingChildTrigger = {
    stageId: string;
    stageLabel: string;
    data: import('./workflow.schema').EmbeddedChildTrigger;
  };
  const pendingChildTriggers: PendingChildTrigger[] = [];

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
    const secondary = node.data.secondary_actions ?? [];

    // Track index-within-type so embedded approval policies can resolve to
    // the right action UUID by (actionType, actionIndex).
    primary.forEach((action, idx) => {
      const a = action as {
        stage_status_id: string;
        action_criteria_id?: string | null;
        roles_id?: unknown[];
        employees_id?: unknown[];
      };
      const actionId = randomUUID();
      actionRows.push({
        id: actionId,
        workflowStageId: stageId,
        workflowActionId: a.stage_status_id,
        criteriaId: a.action_criteria_id ?? defaultCriteriaId ?? null,
        isPrimary: true,
      });
      actionIdByRef.set(`${stageId}:primary:${idx}`, actionId);
      for (const roleId of toIdList(a.roles_id)) roleConnects.push({ actionId, roleId });
      for (const userId of toIdList(a.employees_id)) userConnects.push({ actionId, userId });
    });
    secondary.forEach((action, idx) => {
      const a = action as {
        stage_status_id: string;
        action_criteria_id?: string | null;
        roles_id?: unknown[];
        employees_id?: unknown[];
      };
      const actionId = randomUUID();
      actionRows.push({
        id: actionId,
        workflowStageId: stageId,
        workflowActionId: a.stage_status_id,
        criteriaId: a.action_criteria_id ?? defaultCriteriaId ?? null,
        isPrimary: false,
      });
      actionIdByRef.set(`${stageId}:secondary:${idx}`, actionId);
      for (const roleId of toIdList(a.roles_id)) roleConnects.push({ actionId, roleId });
      for (const userId of toIdList(a.employees_id)) userConnects.push({ actionId, userId });
    });

    // ── Phase 3.5+ embedded policy intent ────────────────────────────────
    // Form bindings — one StageFormBinding row per entry, keyed by formId.
    // Access lists (fill/view roles+users) are connected during per-row
    // materialisation after the bulk stage insert (see below).
    const embeddedForms = (node.data.formBindings ??
      []) as import('./workflow.schema').EmbeddedFormBinding[];
    for (const fb of embeddedForms) {
      pendingFormBindings.push({
        stageId,
        stageLabel: node.data.label,
        data: fb,
      });
    }

    // SLA — at most one per stage. Defer execution because thresholds need
    // the policy id which only exists after the create call returns.
    const embeddedSla = (node.data as { sla?: unknown }).sla;
    if (embeddedSla && typeof embeddedSla === 'object' && 'duration' in embeddedSla) {
      pendingSlaPolicies.push({
        stageId,
        data: embeddedSla as PendingSla['data'],
      });
    }

    // Approval policies — one per (action, mode). Resolve actionId after
    // the action row inserts complete; track the ref now.
    const embeddedApprovals = ((node.data as { approvalPolicies?: unknown[] })
      .approvalPolicies ?? []) as PendingApproval['data'][];
    for (const ap of embeddedApprovals) {
      pendingApprovalPolicies.push({
        stageId,
        actionRef: `${stageId}:${ap.actionType}:${ap.actionIndex}`,
        data: ap,
      });
    }

    // Child-workflow triggers — "from this stage, raise a child ticket of
    // workflow X". Materialised after the bulk stage insert (childWorkflowId
    // validated there).
    const embeddedChildTriggers = (node.data.childTriggers ??
      []) as import('./workflow.schema').EmbeddedChildTrigger[];
    embeddedChildTriggers.forEach((ct, idx) => {
      pendingChildTriggers.push({
        stageId,
        stageLabel: node.data.label,
        data: { ...ct, order: ct.order ?? idx },
      });
    });

    // Legacy / future fields the builder doesn't process yet.
    if ((node.data.dependency ?? []).length > 0)
      warnings.push(`Stage '${node.data.label}': dependencies deferred to Engine phase`);
    if ((node.data.form_visibility_rules ?? []).length > 0)
      warnings.push(
        `Stage '${node.data.label}': cross-stage form rules deferred to Forms phase`,
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

  // ─── Phase 3.5+ embedded-policy materialisation ─────────────────────────
  // Forms — per-row create so we can connect the fill/view access lists.
  // A role/user referenced in an access list may have been deleted between
  // authoring and publish; a Prisma `connect` to a missing id would abort the
  // whole transaction, so we resolve all referenced ids up front, drop the
  // missing ones, and surface a warning (mirrors the stale approval-ref path).
  if (pendingFormBindings.length > 0) {
    const allRoleIds = new Set<string>();
    const allUserIds = new Set<string>();
    for (const { data } of pendingFormBindings) {
      for (const id of [...(data.fillRoleIds ?? []), ...(data.viewRoleIds ?? [])])
        allRoleIds.add(id);
      for (const id of [...(data.fillUserIds ?? []), ...(data.viewUserIds ?? [])])
        allUserIds.add(id);
    }
    const [existingRoles, existingUsers] = await Promise.all([
      allRoleIds.size > 0
        ? tx.role.findMany({ where: { id: { in: [...allRoleIds] } }, select: { id: true } })
        : Promise.resolve([] as { id: string }[]),
      allUserIds.size > 0
        ? tx.user.findMany({ where: { id: { in: [...allUserIds] } }, select: { id: true } })
        : Promise.resolve([] as { id: string }[]),
    ]);
    const validRoleIds = new Set(existingRoles.map((r) => r.id));
    const validUserIds = new Set(existingUsers.map((u) => u.id));

    for (const { stageId, stageLabel, data } of pendingFormBindings) {
      const pruneRoles = (ids: string[] | undefined, kind: string) => {
        const kept = (ids ?? []).filter((id) => validRoleIds.has(id));
        const dropped = (ids ?? []).length - kept.length;
        if (dropped > 0)
          warnings.push(
            `Form '${data.formId}' on stage '${stageLabel}': ${dropped} missing ${kind} role(s) skipped`,
          );
        return kept;
      };
      const pruneUsers = (ids: string[] | undefined, kind: string) => {
        const kept = (ids ?? []).filter((id) => validUserIds.has(id));
        const dropped = (ids ?? []).length - kept.length;
        if (dropped > 0)
          warnings.push(
            `Form '${data.formId}' on stage '${stageLabel}': ${dropped} missing ${kind} user(s) skipped`,
          );
        return kept;
      };

      const fillRoleIds = pruneRoles(data.fillRoleIds, 'fill');
      const fillUserIds = pruneUsers(data.fillUserIds, 'fill');
      const viewRoleIds = pruneRoles(data.viewRoleIds, 'view');
      const viewUserIds = pruneUsers(data.viewUserIds, 'view');

      if (fillRoleIds.length === 0 && fillUserIds.length === 0) {
        warnings.push(
          `Form '${data.formId}' on stage '${stageLabel}': no valid fill audience — anyone will be able to read & fill it`,
        );
      }

      const connect = (ids: string[]) =>
        ids.length > 0 ? { connect: ids.map((id) => ({ id })) } : undefined;

      await tx.stageFormBinding.create({
        data: {
          workflowId,
          stageId,
          formId: data.formId,
          isRequired: data.isRequired ?? true,
          position: data.position ?? 0,
          fillMode: data.fillMode ?? 'ANYONE',
          allowedFillRoles: connect(fillRoleIds),
          allowedFillUsers: connect(fillUserIds),
          allowedViewRoles: connect(viewRoleIds),
          allowedViewUsers: connect(viewUserIds),
        },
      });
    }
  }

  // SLA policies — one per stage; thresholds linked via FK so we create the
  // policy, then bulk insert thresholds against it.
  for (const pending of pendingSlaPolicies) {
    const sla = await tx.slaPolicy.create({
      data: {
        parentStageId: pending.stageId,
        duration: pending.data.duration,
        calendarId: pending.data.calendarId ?? null,
        escalationWorkflowId: pending.data.escalationWorkflowId ?? null,
        pauseOnHold: pending.data.pauseOnHold,
        pauseOnExtensionPending: pending.data.pauseOnExtensionPending,
      },
      select: { id: true },
    });
    if (pending.data.thresholds.length > 0) {
      // Resolve targetStageCanonicalId → targetSlaStageId via the just-built
      // stage map. Unknown canonicalIds become null (logged as a warning).
      const thresholdRows: Prisma.SlaThresholdCreateManyInput[] = [];
      for (const th of pending.data.thresholds) {
        let targetSlaStageId: string | null = null;
        if (th.targetStageCanonicalId) {
          const resolved = stageByNodeId.get(th.targetStageCanonicalId);
          if (resolved) targetSlaStageId = resolved.id;
          else
            warnings.push(
              `SLA threshold '${th.name}' targets unknown stage '${th.targetStageCanonicalId}'`,
            );
        }
        thresholdRows.push({
          policyId: sla.id,
          name: th.name,
          percentage: th.percentage,
          targetSlaStageId,
        });
      }
      await tx.slaThreshold.createMany({ data: thresholdRows });
    }
  }

  // Approval policies — one per (stage, action). Resolve actionId via
  // actionIdByRef. Skip with a warning if the ref is stale (e.g. user
  // reordered actions after creating the embedded policy).
  for (const pending of pendingApprovalPolicies) {
    const actionId = actionIdByRef.get(pending.actionRef);
    if (!actionId) {
      warnings.push(
        `Approval policy references missing action ref '${pending.actionRef}' — skipped`,
      );
      continue;
    }
    await tx.approvalPolicy.create({
      data: {
        workflowId,
        stageId: pending.stageId,
        actionId,
        mode: pending.data.mode,
        requiredCount: pending.data.requiredCount,
        strictRoleMatch: pending.data.strictRoleMatch,
        allowSelfApproval: pending.data.allowSelfApproval,
        requireUniqueApprovers: pending.data.requireUniqueApprovers,
        approvalSequence:
          pending.data.approvalSequence === undefined
            ? Prisma.JsonNull
            : (pending.data.approvalSequence as Prisma.InputJsonValue),
        approvalSlaHours: pending.data.approvalSlaHours ?? null,
        isActive: pending.data.isActive,
        approverRoles:
          pending.data.approverRoleIds.length > 0
            ? {
                connect: pending.data.approverRoleIds.map((id) => ({ id })),
              }
            : undefined,
        approverUsers:
          pending.data.approverUserIds.length > 0
            ? {
                connect: pending.data.approverUserIds.map((id) => ({ id })),
              }
            : undefined,
      },
    });
  }

  // Child-workflow triggers — one row per entry. Validate every childWorkflowId
  // up front (FK is onDelete: Restrict → a stale id aborts the tx), drop the
  // missing ones with a warning, then bulk insert.
  if (pendingChildTriggers.length > 0) {
    const ids = [...new Set(pendingChildTriggers.map((p) => p.data.childWorkflowId))];
    const existing = await tx.workflow.findMany({
      where: { id: { in: ids }, isDeleted: false },
      select: { id: true },
    });
    const validIds = new Set(existing.map((w) => w.id));
    const triggerRows: Prisma.ChildWorkflowTriggerCreateManyInput[] = [];
    for (const { stageId, stageLabel, data } of pendingChildTriggers) {
      if (!validIds.has(data.childWorkflowId)) {
        warnings.push(
          `Stage '${stageLabel}': child trigger references missing/deleted workflow '${data.childWorkflowId}' — skipped`,
        );
        continue;
      }
      triggerRows.push({
        parentStageId: stageId,
        childWorkflowId: data.childWorkflowId,
        triggerMode: data.triggerMode,
        isBlocking: data.isBlocking,
        allowMultiple: data.allowMultiple,
        order: data.order,
      });
    }
    if (triggerRows.length > 0) {
      await tx.childWorkflowTrigger.createMany({ data: triggerRows });
    }
  }

  return { warnings };
};

