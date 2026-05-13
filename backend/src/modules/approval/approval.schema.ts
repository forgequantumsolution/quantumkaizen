/**
 * Zod schemas for the Approval module.
 *
 * Field names + enum values match the Phase 3 Prisma schema (post-Django
 * alignment). See docs/WORKFLOW_PHASE_3_PLAN.md §3a for rationale.
 */
import { z } from 'zod';

export const ApprovalModeSchema = z.enum([
  'SINGLE',
  'ALL_REQUIRED',
  'QUORUM',
  'SEQUENTIAL',
  'ANY',
]);

/**
 * One step in an `approvalSequence` (only used when mode = SEQUENTIAL).
 * A step must designate either a role or a user (not both, not neither).
 */
const ApprovalSequenceStepSchema = z
  .object({
    order: z.number().int().min(1),
    roleId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    label: z.string().min(1).max(200).optional(),
  })
  .refine((s) => Boolean(s.roleId) !== Boolean(s.userId), {
    message: 'Each approval sequence step must specify exactly one of roleId or userId',
  });

const ApproverIdsSchema = z.array(z.string().uuid()).max(200);

// ─── URL params ────────────────────────────────────────────────────────────

export const IdParamSchema = z.object({ id: z.string().uuid() });
export const WorkflowIdParamSchema = z.object({ id: z.string().uuid() });
export const TicketIdParamSchema = z.object({ id: z.string().uuid() });
export const InstanceIdParamSchema = z.object({ instanceId: z.string().uuid() });

// ─── Bodies ────────────────────────────────────────────────────────────────

const policyShape = {
  stageId: z.string().uuid(),
  actionId: z.string().uuid(),
  mode: ApprovalModeSchema,
  requiredCount: z.number().int().min(1).max(100).default(1),
  strictRoleMatch: z.boolean().default(false),
  allowSelfApproval: z.boolean().default(false),
  requireUniqueApprovers: z.boolean().default(true),
  approvalSequence: z.array(ApprovalSequenceStepSchema).max(50).optional(),
  approvalSlaHours: z.number().int().min(1).max(24 * 365).nullish(),
  isActive: z.boolean().default(true),
  approverRoleIds: ApproverIdsSchema.default([]),
  approverUserIds: ApproverIdsSchema.default([]),
};

const requiresApproverSet = (mode: z.infer<typeof ApprovalModeSchema>) =>
  // SEQUENTIAL gets its approver list from `approvalSequence`; all other modes
  // need an explicit `approverRoleIds`/`approverUserIds` set.
  mode !== 'SEQUENTIAL';

export const CreateApprovalPolicySchema = z
  .object(policyShape)
  .refine(
    (d) =>
      !requiresApproverSet(d.mode) ||
      d.approverRoleIds.length + d.approverUserIds.length > 0,
    {
      message: 'Non-sequential policies must list at least one approver role or user',
      path: ['approverRoleIds'],
    },
  )
  .refine(
    (d) => d.mode !== 'SEQUENTIAL' || (d.approvalSequence && d.approvalSequence.length > 0),
    {
      message: 'SEQUENTIAL mode requires a non-empty approvalSequence',
      path: ['approvalSequence'],
    },
  );

// PATCH bodies are partial — every field optional, but if mode is provided we
// re-validate the sequence/approver-set invariants in the service after merge
// (Zod can't reach the existing row).
export const UpdateApprovalPolicySchema = z
  .object({
    mode: ApprovalModeSchema.optional(),
    requiredCount: z.number().int().min(1).max(100).optional(),
    strictRoleMatch: z.boolean().optional(),
    allowSelfApproval: z.boolean().optional(),
    requireUniqueApprovers: z.boolean().optional(),
    approvalSequence: z.array(ApprovalSequenceStepSchema).max(50).nullable().optional(),
    approvalSlaHours: z.number().int().min(1).max(24 * 365).nullable().optional(),
    isActive: z.boolean().optional(),
    approverRoleIds: ApproverIdsSchema.optional(),
    approverUserIds: ApproverIdsSchema.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'PATCH body must contain at least one field',
  });

// ─── Decide endpoint body ──────────────────────────────────────────────────

export const DecideApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(2000).optional(),
});

// ─── Inferred types ────────────────────────────────────────────────────────

export type CreateApprovalPolicyInput = z.infer<typeof CreateApprovalPolicySchema>;
export type UpdateApprovalPolicyInput = z.infer<typeof UpdateApprovalPolicySchema>;
export type ApprovalSequenceStep = z.infer<typeof ApprovalSequenceStepSchema>;
export type DecideApprovalInput = z.infer<typeof DecideApprovalSchema>;
