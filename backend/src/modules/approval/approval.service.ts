/**
 * Approval module service.
 *
 * Surface:
 *   listPoliciesForWorkflow / getPolicy / createPolicy / updatePolicy / softDeletePolicy
 *   listApprovalsForTicket / getInstance
 *
 * NOTE: the `/decide` endpoint is intentionally NOT here — it requires the
 * engine intercept (`engine/approval.layer.ts`) which lands in P3.5. This
 * module ships the admin + read surface only; decisions go through the engine.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import type {
  CreateApprovalPolicyInput,
  UpdateApprovalPolicyInput,
} from './approval.schema';

// ─── Selects ───────────────────────────────────────────────────────────────

const policySelect = {
  id: true,
  workflowId: true,
  stageId: true,
  actionId: true,
  mode: true,
  requiredCount: true,
  strictRoleMatch: true,
  allowSelfApproval: true,
  requireUniqueApprovers: true,
  approvalSequence: true,
  approvalSlaHours: true,
  isActive: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  approverRoles: { select: { id: true, name: true } },
  approverUsers: { select: { id: true, name: true, email: true } },
  stage: { select: { id: true, name: true, canonicalId: true } },
  action: {
    select: {
      id: true,
      isPrimary: true,
      workflowAction: { select: { id: true, name: true, behavior: true } },
    },
  },
} satisfies Prisma.ApprovalPolicySelect;

const recordSelect = {
  id: true,
  decision: true,
  comment: true,
  decidedAt: true,
  sequenceOrder: true,
  approver: { select: { id: true, name: true, email: true } },
  approvedAsRole: { select: { id: true, name: true } },
} satisfies Prisma.ApprovalRecordSelect;

const instanceSelect = {
  id: true,
  ticketId: true,
  policyId: true,
  triggeringActionId: true,
  status: true,
  startedAt: true,
  completedAt: true,
  deadlineAt: true,
  currentSequenceOrder: true,
  invalidatedAt: true,
  invalidatedReason: true,
  createdAt: true,
  updatedAt: true,
  policy: {
    select: {
      id: true,
      mode: true,
      requiredCount: true,
      approverRoles: { select: { id: true, name: true } },
      approverUsers: { select: { id: true, name: true, email: true } },
      stage: { select: { id: true, name: true, canonicalId: true } },
      action: {
        select: {
          id: true,
          workflowAction: { select: { id: true, name: true, behavior: true } },
        },
      },
    },
  },
  records: {
    select: recordSelect,
    orderBy: { decidedAt: 'asc' } as const,
  },
} satisfies Prisma.ApprovalInstanceSelect;

// ─── Internal validators ───────────────────────────────────────────────────

const assertPolicyCoherent = (input: Pick<
  CreateApprovalPolicyInput,
  'mode' | 'approverRoleIds' | 'approverUserIds' | 'approvalSequence'
>) => {
  if (input.mode === 'SEQUENTIAL') {
    if (!input.approvalSequence || input.approvalSequence.length === 0) {
      throw BadRequest('SEQUENTIAL mode requires a non-empty approvalSequence');
    }
  } else {
    if (input.approverRoleIds.length + input.approverUserIds.length === 0) {
      throw BadRequest('Non-sequential policies must list at least one approver role or user');
    }
  }
};

const assertStageActionPair = async (
  workflowId: string,
  stageId: string,
  actionId: string,
) => {
  const stage = await prisma.workflowStage.findUnique({
    where: { id: stageId },
    select: { id: true, workflowId: true, isDeleted: true },
  });
  if (!stage || stage.isDeleted) throw NotFound(`Stage ${stageId} not found`);
  if (stage.workflowId !== workflowId) {
    throw BadRequest(`Stage ${stageId} does not belong to workflow ${workflowId}`);
  }

  const action = await prisma.workflowStageAction.findUnique({
    where: { id: actionId },
    select: { id: true, workflowStageId: true, isDeleted: true },
  });
  if (!action || action.isDeleted) throw NotFound(`Action ${actionId} not found`);
  if (action.workflowStageId !== stageId) {
    throw BadRequest(`Action ${actionId} does not belong to stage ${stageId}`);
  }
};

// ─── Policy CRUD ───────────────────────────────────────────────────────────

export const listPoliciesForWorkflow = async (
  workflowId: string,
  opts: { includeInactive?: boolean; includeDeleted?: boolean } = {},
) => {
  const wf = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, isDeleted: true },
  });
  if (!wf || wf.isDeleted) throw NotFound(`Workflow ${workflowId} not found`);

  const where: Prisma.ApprovalPolicyWhereInput = { workflowId };
  if (!opts.includeDeleted) where.isDeleted = false;
  if (!opts.includeInactive) where.isActive = true;

  return prisma.approvalPolicy.findMany({
    where,
    orderBy: [{ stage: { name: 'asc' } }, { createdAt: 'asc' }],
    select: policySelect,
  });
};

export const getPolicy = async (id: string) => {
  const policy = await prisma.approvalPolicy.findUnique({
    where: { id },
    select: policySelect,
  });
  if (!policy) throw NotFound(`Approval policy ${id} not found`);
  return policy;
};

export const createPolicy = async (
  workflowId: string,
  input: CreateApprovalPolicyInput,
) => {
  assertPolicyCoherent(input);

  const wf = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, isDeleted: true },
  });
  if (!wf || wf.isDeleted) throw NotFound(`Workflow ${workflowId} not found`);

  await assertStageActionPair(workflowId, input.stageId, input.actionId);

  // @@unique([stageId, actionId]) makes this idempotent — surface a clean 409
  // before the DB raises one.
  const existing = await prisma.approvalPolicy.findUnique({
    where: { stageId_actionId: { stageId: input.stageId, actionId: input.actionId } },
    select: { id: true, isDeleted: true },
  });
  if (existing && !existing.isDeleted) {
    throw Conflict('An approval policy already exists for this stage + action');
  }
  // If a soft-deleted policy is sitting on the same (stage, action), revive it
  // by updating instead of creating — preserves any historical instances.
  if (existing?.isDeleted) {
    return prisma.approvalPolicy.update({
      where: { id: existing.id },
      data: {
        mode: input.mode,
        requiredCount: input.requiredCount,
        strictRoleMatch: input.strictRoleMatch,
        allowSelfApproval: input.allowSelfApproval,
        requireUniqueApprovers: input.requireUniqueApprovers,
        approvalSequence: (input.approvalSequence ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        approvalSlaHours: input.approvalSlaHours ?? null,
        isActive: input.isActive,
        isDeleted: false,
        approverRoles: { set: input.approverRoleIds.map((id) => ({ id })) },
        approverUsers: { set: input.approverUserIds.map((id) => ({ id })) },
      },
      select: policySelect,
    });
  }

  return prisma.approvalPolicy.create({
    data: {
      workflowId,
      stageId: input.stageId,
      actionId: input.actionId,
      mode: input.mode,
      requiredCount: input.requiredCount,
      strictRoleMatch: input.strictRoleMatch,
      allowSelfApproval: input.allowSelfApproval,
      requireUniqueApprovers: input.requireUniqueApprovers,
      approvalSequence: (input.approvalSequence ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      approvalSlaHours: input.approvalSlaHours ?? null,
      isActive: input.isActive,
      approverRoles: input.approverRoleIds.length
        ? { connect: input.approverRoleIds.map((id) => ({ id })) }
        : undefined,
      approverUsers: input.approverUserIds.length
        ? { connect: input.approverUserIds.map((id) => ({ id })) }
        : undefined,
    },
    select: policySelect,
  });
};

export const updatePolicy = async (id: string, input: UpdateApprovalPolicyInput) => {
  const existing = await prisma.approvalPolicy.findUnique({
    where: { id },
    select: {
      id: true,
      isDeleted: true,
      mode: true,
      approverRoles: { select: { id: true } },
      approverUsers: { select: { id: true } },
      approvalSequence: true,
    },
  });
  if (!existing) throw NotFound(`Approval policy ${id} not found`);
  if (existing.isDeleted) throw BadRequest('Cannot update a soft-deleted policy');

  // Coherence check against the post-update view of the policy. If the caller
  // is changing mode, they must also supply the matching approver-set or
  // sequence in the same PATCH; we don't allow inconsistent intermediate states.
  if (input.mode !== undefined) {
    const projectedMode = input.mode;
    const projectedRoleIds =
      input.approverRoleIds ?? existing.approverRoles.map((r) => r.id);
    const projectedUserIds =
      input.approverUserIds ?? existing.approverUsers.map((u) => u.id);
    const projectedSequence =
      input.approvalSequence !== undefined ? input.approvalSequence : existing.approvalSequence;

    assertPolicyCoherent({
      mode: projectedMode,
      approverRoleIds: projectedRoleIds,
      approverUserIds: projectedUserIds,
      // approvalSequence is JsonValue from Prisma; the schema-side validator
      // only checks length/truthiness so cast to any-ish shape.
      approvalSequence: (Array.isArray(projectedSequence)
        ? (projectedSequence as unknown as CreateApprovalPolicyInput['approvalSequence'])
        : undefined) as CreateApprovalPolicyInput['approvalSequence'],
    });
  }

  const data: Prisma.ApprovalPolicyUpdateInput = {};
  if (input.mode !== undefined) data.mode = input.mode;
  if (input.requiredCount !== undefined) data.requiredCount = input.requiredCount;
  if (input.strictRoleMatch !== undefined) data.strictRoleMatch = input.strictRoleMatch;
  if (input.allowSelfApproval !== undefined) data.allowSelfApproval = input.allowSelfApproval;
  if (input.requireUniqueApprovers !== undefined)
    data.requireUniqueApprovers = input.requireUniqueApprovers;
  if (input.approvalSequence !== undefined) {
    data.approvalSequence =
      input.approvalSequence === null
        ? Prisma.JsonNull
        : (input.approvalSequence as unknown as Prisma.InputJsonValue);
  }
  if (input.approvalSlaHours !== undefined) data.approvalSlaHours = input.approvalSlaHours;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.approverRoleIds !== undefined) {
    data.approverRoles = { set: input.approverRoleIds.map((id) => ({ id })) };
  }
  if (input.approverUserIds !== undefined) {
    data.approverUsers = { set: input.approverUserIds.map((id) => ({ id })) };
  }

  return prisma.approvalPolicy.update({
    where: { id },
    data,
    select: policySelect,
  });
};

export const softDeletePolicy = async (id: string) => {
  const existing = await prisma.approvalPolicy.findUnique({
    where: { id },
    select: { id: true, isDeleted: true },
  });
  if (!existing) throw NotFound(`Approval policy ${id} not found`);
  if (existing.isDeleted) return; // idempotent — already deleted

  await prisma.approvalPolicy.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
  });
};

// ─── Read: ticket-side ─────────────────────────────────────────────────────

export const listApprovalsForTicket = async (ticketId: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, isDeleted: true },
  });
  if (!ticket) throw NotFound(`Ticket ${ticketId} not found`);

  return prisma.approvalInstance.findMany({
    where: { ticketId },
    orderBy: { startedAt: 'desc' },
    select: instanceSelect,
  });
};

export const getInstance = async (instanceId: string) => {
  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
    select: instanceSelect,
  });
  if (!instance) throw NotFound(`Approval instance ${instanceId} not found`);
  return instance;
};
