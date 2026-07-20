/**
 * Approval intercept layer — called from `orchestrator.performAction` after
 * `access.layer` validates the user but BEFORE `transition.layer` mutates
 * `currentStages`.
 *
 * Public surface (engine-internal):
 *   - `getPolicy(tx, stageId, actionId)`
 *   - `ensureInstance(tx, ticketId, policyId, stageId, triggeringActionId)`
 *   - `recordDecision(tx, instanceId, userId, decision, comment)`
 *   - `isPolicySatisfied(records, policy)`           — pure function
 *   - `getRemainingApprovers(instance, policy)`      — for the UI's "still waiting on" list
 *   - `markInstanceSatisfied(tx, instanceId)`
 *
 * Public surface (called from the `/decide` endpoint, P3.2 was deferred):
 *   - `decide(tx, instanceId, userId, decision, comment)` — full end-to-end:
 *      records the decision, marks satisfied/rejected, returns a result the
 *      caller can fall-through-or-return on.
 *
 * Behaviour: on REJECTED the instance is marked REJECTED, an
 * `APPROVAL_REJECTED` audit fires, and the decision is terminal — the caller
 * then stops the ticket (clears its stages + marks the flow rejected). Any
 * single rejection ends the approval regardless of mode.
 */
import { Prisma } from '@prisma/client';
import { BadRequest, Forbidden, NotFound } from '../../../lib/httpError';
import { emitAuditEvent } from './audit.emitter';
import type { ActorContext } from './types';

type Tx = Prisma.TransactionClient;
type ApprovalDecision = 'APPROVED' | 'REJECTED';
type ApprovalMode = 'SINGLE' | 'ALL_REQUIRED' | 'QUORUM' | 'SEQUENTIAL' | 'ANY';

// ─── Policy lookup ─────────────────────────────────────────────────────────

export const getPolicy = async (tx: Tx, stageId: string, actionId: string) => {
  return tx.approvalPolicy.findUnique({
    where: { stageId_actionId: { stageId, actionId } },
    select: {
      id: true,
      workflowId: true,
      mode: true,
      requiredCount: true,
      strictRoleMatch: true,
      allowSelfApproval: true,
      requireUniqueApprovers: true,
      approvalSequence: true,
      approvalSlaHours: true,
      isActive: true,
      isDeleted: true,
      approverRoles: { select: { id: true } },
      approverUsers: { select: { id: true } },
    },
  });
};

type LoadedPolicy = NonNullable<Awaited<ReturnType<typeof getPolicy>>>;

const computeDeadline = (policy: LoadedPolicy): Date | null => {
  if (!policy.approvalSlaHours) return null;
  return new Date(Date.now() + policy.approvalSlaHours * 60 * 60 * 1000);
};

// ─── Instance lifecycle ────────────────────────────────────────────────────

export const ensureInstance = async (
  tx: Tx,
  ticketId: string,
  policy: LoadedPolicy,
  triggeringActionId: string,
) => {
  // Find an OPEN instance (PENDING) for this ticket+policy first.
  const open = await tx.approvalInstance.findFirst({
    where: { ticketId, policyId: policy.id, status: 'PENDING' },
    select: { id: true, currentSequenceOrder: true, deadlineAt: true },
  });
  if (open) return open;

  // None open — create a new one. The @@unique([ticket, policy]) on
  // ApprovalInstance is from Django; we work around it by checking for an
  // existing (closed) row first and bumping the unique with a soft-delete-style
  // flag if needed. Simpler: ensure there's at most one PENDING per
  // (ticket, policy) by query, and let closed instances co-exist.
  //
  // For Phase 3 our schema does NOT carry the @@unique([ticket, policy]) that
  // Django has — multiple ApprovalInstance rows per (ticket, policy) are
  // permitted (e.g. retry after rejection). The PENDING-or-not check above
  // guarantees we never have two open simultaneously.
  return tx.approvalInstance.create({
    data: {
      ticketId,
      policyId: policy.id,
      triggeringActionId,
      status: 'PENDING',
      deadlineAt: computeDeadline(policy),
      currentSequenceOrder: 1,
    },
    select: { id: true, currentSequenceOrder: true, deadlineAt: true },
  });
};

// ─── Decision recording ────────────────────────────────────────────────────

interface RecordDecisionParams {
  instanceId: string;
  userId: string;
  decision: ApprovalDecision;
  comment?: string | null;
  approvedAsRoleId?: string | null;
}

export const recordDecision = async (tx: Tx, params: RecordDecisionParams) => {
  const instance = await tx.approvalInstance.findUnique({
    where: { id: params.instanceId },
    select: {
      id: true,
      ticketId: true,
      status: true,
      currentSequenceOrder: true,
      policy: {
        select: {
          id: true,
          mode: true,
          allowSelfApproval: true,
          requireUniqueApprovers: true,
          approverRoles: { select: { id: true } },
          approverUsers: { select: { id: true } },
        },
      },
      records: {
        select: { approverId: true, decision: true, sequenceOrder: true },
      },
    },
  });
  if (!instance) throw NotFound(`Approval instance ${params.instanceId} not found`);
  if (instance.status !== 'PENDING') {
    throw BadRequest(`Approval instance is already ${instance.status}`);
  }

  // SUPER_ADMIN bypasses eligibility + self-approval checks (god-mode role).
  // Resolve the caller's role name once and reuse below.
  const caller = await tx.user.findUnique({
    where: { id: params.userId },
    select: { roleId: true, role: { select: { name: true } } },
  });
  const isSuperAdmin = caller?.role?.name === 'SUPER_ADMIN';

  // Whether the caller was named directly in approverUsers (vs only inherited
  // via a role). Explicit per-user grants override `allowSelfApproval=false`
  // — putting someone in `approverUserIds` is the policy author's signal
  // that this specific person can approve regardless of who raised the ticket.
  const isApproverUser = instance.policy.approverUsers.some((u) => u.id === params.userId);

  // Self-approval check: ticket creator can't approve their own ticket UNLESS
  //   - policy.allowSelfApproval is on, OR
  //   - caller is SUPER_ADMIN, OR
  //   - caller was named directly in approverUsers (explicit grant overrides).
  if (
    !instance.policy.allowSelfApproval &&
    !isSuperAdmin &&
    !isApproverUser
  ) {
    const ticket = await tx.ticket.findUnique({
      where: { id: instance.ticketId },
      select: { createdById: true },
    });
    if (ticket?.createdById && ticket.createdById === params.userId) {
      throw Forbidden('You cannot approve your own ticket');
    }
  }

  // Already-approved check (one record per approver per instance).
  if (instance.records.some((r) => r.approverId === params.userId)) {
    throw BadRequest('You have already recorded a decision for this instance');
  }

  // Uniqueness check: same approver across all the records.
  // (The @@unique([instanceId, approverId]) DB constraint enforces this too;
  // we surface a clean error here before the DB raises one.)
  if (instance.policy.requireUniqueApprovers) {
    if (instance.records.some((r) => r.approverId === params.userId)) {
      throw BadRequest('You have already recorded a decision on this instance');
    }
  }

  // Approver eligibility: must be in approverUsers OR have a role in
  // approverRoles. SUPER_ADMIN bypasses this entirely.
  let qualifyingRoleId: string | null = null;
  if (!isApproverUser && !isSuperAdmin) {
    if (caller?.roleId && instance.policy.approverRoles.some((r) => r.id === caller.roleId)) {
      qualifyingRoleId = caller.roleId;
    }
  }
  if (!isApproverUser && !qualifyingRoleId && !isSuperAdmin) {
    throw Forbidden('You are not listed as an approver for this policy');
  }

  return tx.approvalRecord.create({
    data: {
      instanceId: params.instanceId,
      approverId: params.userId,
      approvedAsRoleId: params.approvedAsRoleId ?? qualifyingRoleId ?? null,
      decision: params.decision,
      comment: params.comment ?? null,
      sequenceOrder: instance.currentSequenceOrder,
    },
    select: { id: true },
  });
};

// ─── Satisfaction logic (pure function over loaded records + policy) ──────

interface RecordRef {
  approverId: string;
  decision: ApprovalDecision;
  sequenceOrder: number;
}

interface SequenceStep {
  order: number;
  roleId?: string;
  userId?: string;
}

export const isPolicySatisfied = (
  records: RecordRef[],
  policy: { mode: ApprovalMode; requiredCount: number; approvalSequence: Prisma.JsonValue },
): boolean => {
  const approved = records.filter((r) => r.decision === 'APPROVED');
  switch (policy.mode) {
    case 'SINGLE':
      return approved.length >= 1;
    case 'ANY':
      return approved.length >= 1;
    case 'ALL_REQUIRED':
      // ALL_REQUIRED = every required approver has approved.
      // For Phase 3 we approximate as "requiredCount distinct approvers" since
      // the approver list is a union of roles + users that's hard to enumerate.
      return new Set(approved.map((r) => r.approverId)).size >= policy.requiredCount;
    case 'QUORUM':
      return new Set(approved.map((r) => r.approverId)).size >= policy.requiredCount;
    case 'SEQUENTIAL': {
      // approvalSequence is [{ order, roleId | userId, label }]; one APPROVED
      // record needed at each `order` 1..N in turn. No skips.
      const seq = Array.isArray(policy.approvalSequence)
        ? (policy.approvalSequence as unknown as SequenceStep[])
        : [];
      if (seq.length === 0) return approved.length >= 1;
      const approvedOrders = new Set(approved.map((r) => r.sequenceOrder));
      return seq.every((step) => approvedOrders.has(step.order));
    }
    default:
      return false;
  }
};

export const isPolicyUnsatisfiable = (
  records: RecordRef[],
  policy: { mode: ApprovalMode; requiredCount: number },
): boolean => {
  // A REJECTED record can make ALL_REQUIRED/SEQUENTIAL unsatisfiable
  // immediately (one rejection blocks consensus). QUORUM/ANY/SINGLE simply
  // need a future APPROVAL — a rejection doesn't sink them.
  const rejected = records.some((r) => r.decision === 'REJECTED');
  if (!rejected) return false;
  return policy.mode === 'ALL_REQUIRED' || policy.mode === 'SEQUENTIAL';
};

// ─── Full /decide entry point ──────────────────────────────────────────────

export interface DecideResult {
  status: 'satisfied' | 'pending' | 'rejected';
  instanceId: string;
  remaining?: { rolesRequired: number; recordedApprovers: number };
}

/**
 * End-to-end: validate + write record + check satisfaction. Returns:
 *   - `satisfied` → caller should now perform the transition path
 *   - `pending`   → caller returns "still pending, N approvers left" to the user
 *   - `rejected`  → instance flipped to REJECTED; ticket STAYS in stage (Q5)
 */
export const decide = async (
  tx: Tx,
  params: {
    instanceId: string;
    decision: ApprovalDecision;
    comment?: string | null;
    actor: ActorContext;
  },
): Promise<DecideResult> => {
  await recordDecision(tx, {
    instanceId: params.instanceId,
    userId: params.actor.id,
    decision: params.decision,
    comment: params.comment ?? null,
  });

  // Re-read instance + records to compute satisfaction.
  const instance = await tx.approvalInstance.findUnique({
    where: { id: params.instanceId },
    select: {
      id: true,
      ticketId: true,
      policy: {
        select: {
          id: true,
          mode: true,
          requiredCount: true,
          approvalSequence: true,
        },
      },
      records: {
        select: { approverId: true, decision: true, sequenceOrder: true },
      },
    },
  });
  if (!instance) throw NotFound(`Approval instance ${params.instanceId} not found`);

  // Rejection path — any REJECTED decision is terminal: flip the instance,
  // fire audit, return "rejected". The caller (orchestrator / approval service)
  // then stops the ticket (clears its stages + marks the flow rejected). A
  // single rejection ends the approval regardless of mode — reject means stop.
  if (params.decision === 'REJECTED') {
    await tx.approvalInstance.update({
      where: { id: instance.id },
      data: { status: 'REJECTED', completedAt: new Date() },
    });
    await emitAuditEvent(
      tx,
      { ticketId: instance.ticketId },
      'APPROVAL_REJECTED',
      {
        instanceId: instance.id,
        policyId: instance.policy.id,
        policyMode: instance.policy.mode,
        comment: params.comment ?? null,
      },
      params.actor,
    );
    return { status: 'rejected', instanceId: instance.id };
  }

  // APPROVED path — check satisfaction.
  if (isPolicySatisfied(instance.records, instance.policy)) {
    await tx.approvalInstance.update({
      where: { id: instance.id },
      data: { status: 'SATISFIED', completedAt: new Date() },
    });
    await emitAuditEvent(
      tx,
      { ticketId: instance.ticketId },
      'APPROVAL_SATISFIED',
      { instanceId: instance.id, policyId: instance.policy.id, policyMode: instance.policy.mode },
      params.actor,
    );
    return { status: 'satisfied', instanceId: instance.id };
  }

  await emitAuditEvent(
    tx,
    { ticketId: instance.ticketId },
    'APPROVAL_DECISION_RECORDED',
    { instanceId: instance.id, decision: 'APPROVED' },
    params.actor,
  );

  return {
    status: 'pending',
    instanceId: instance.id,
    remaining: {
      rolesRequired: instance.policy.requiredCount,
      recordedApprovers: instance.records.filter((r) => r.decision === 'APPROVED').length,
    },
  };
};
