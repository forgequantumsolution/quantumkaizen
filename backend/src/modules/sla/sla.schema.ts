/**
 * Zod schemas for the SLA module.
 *
 * Field names match the Phase 3 Prisma schema (post-Django alignment).
 * See docs/WORKFLOW_PHASE_3_PLAN.md §3a for the rationale on each field.
 */
import { z } from 'zod';

export const SlaTimerStatusSchema = z.enum([
  'RUNNING',
  'PAUSED',
  'EXTENDED',
  'COMPLETED',
  'BREACHED',
]);

export const ExtensionStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export const ExtensionDecisionSchema = z.enum(['APPROVED', 'REJECTED']);

const RoleOrUserIdsSchema = z.array(z.string().uuid()).max(200);

// ─── URL params ────────────────────────────────────────────────────────────

export const IdParamSchema = z.object({ id: z.string().uuid() });

// ─── SlaPolicy bodies ──────────────────────────────────────────────────────

const policyShape = {
  parentStageId: z.string().uuid(),
  // Duration in seconds. Max ~31 days (2,678,400s) is a hard upper bound to
  // catch typos like "365 days" entered as seconds. Tune if needed.
  duration: z.number().int().min(60).max(2_678_400),
  calendarId: z.string().uuid().nullish(),
  // Spawn an escalation child ticket on this workflow when the parent enters
  // the SLA-tracked stage (Phase 3 plan Q13 / R1). Optional — null means
  // notification-only thresholds (no auto-transitions).
  escalationWorkflowId: z.string().uuid().nullish(),
  pauseOnHold: z.boolean().default(true),
  pauseOnExtensionPending: z.boolean().default(false),
  responsibleRoleIds: RoleOrUserIdsSchema.default([]),
  responsibleUserIds: RoleOrUserIdsSchema.default([]),
};

export const CreateSlaPolicySchema = z.object(policyShape);

export const UpdateSlaPolicySchema = z
  .object({
    duration: z.number().int().min(60).max(2_678_400).optional(),
    calendarId: z.string().uuid().nullable().optional(),
    escalationWorkflowId: z.string().uuid().nullable().optional(),
    pauseOnHold: z.boolean().optional(),
    pauseOnExtensionPending: z.boolean().optional(),
    responsibleRoleIds: RoleOrUserIdsSchema.optional(),
    responsibleUserIds: RoleOrUserIdsSchema.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'PATCH body must contain at least one field',
  });

// ─── Threshold upsert ──────────────────────────────────────────────────────

const ThresholdShape = z.object({
  // Required, unique-per-policy. Django uses values like 'warning', 'critical',
  // 'breach'. Free-form so admins can name them however they want.
  name: z.string().min(1).max(50),
  // Float; configured threshold (the actual fired % is captured separately on
  // the SlaTimerEvent row).
  percentage: z.number().min(0).max(100),
  // Optional escalation-workflow stage to transition the SPAWNED escalation
  // ticket to (Q13). Null = notification-only threshold.
  targetSlaStageId: z.string().uuid().nullable().optional(),
  notifyRoleIds: RoleOrUserIdsSchema.default([]),
  notifyUserIds: RoleOrUserIdsSchema.default([]),
});

export const UpsertThresholdsSchema = z.object({
  // Replace-all-by-name: every threshold name NOT in this list is deleted;
  // names IN the list are inserted or updated. Pass `[]` to clear all.
  thresholds: z.array(ThresholdShape).max(20),
});

// ─── Timer dashboard list query ────────────────────────────────────────────

export const ListTimersQuerySchema = z.object({
  status: SlaTimerStatusSchema.optional(),
  workflowId: z.string().uuid().optional(),
  ticketId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

// ─── Extension flow ────────────────────────────────────────────────────────

export const RequestExtensionSchema = z.object({
  // Seconds to push the deadline by, if approved. Max 30 days.
  extensionSec: z.number().int().min(60).max(2_592_000),
  reason: z.string().min(1).max(1000),
});

export const DecideExtensionSchema = z.object({
  decision: ExtensionDecisionSchema,
  // Optional reason captured on the extension; informative for audit.
  reason: z.string().max(1000).optional(),
});

// ─── Inferred types ────────────────────────────────────────────────────────

export type CreateSlaPolicyInput = z.infer<typeof CreateSlaPolicySchema>;
export type UpdateSlaPolicyInput = z.infer<typeof UpdateSlaPolicySchema>;
export type UpsertThresholdsInput = z.infer<typeof UpsertThresholdsSchema>;
export type ListTimersQuery = z.infer<typeof ListTimersQuerySchema>;
export type RequestExtensionInput = z.infer<typeof RequestExtensionSchema>;
export type DecideExtensionInput = z.infer<typeof DecideExtensionSchema>;
