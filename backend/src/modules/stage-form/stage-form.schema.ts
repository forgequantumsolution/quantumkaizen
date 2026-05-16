/**
 * Zod schemas for the StageFormBinding module (Phase 3.5).
 *
 * Bindings are owned by (workflowId, stageId) and reference a `Form` by its
 * logical id (not version) — see docs/WORKFLOW_PHASE_3_5_PLAN.md §3 + Q3.
 */
import { z } from 'zod';

// ─── URL params ────────────────────────────────────────────────────────────

export const IdParamSchema = z.object({ id: z.string().uuid() });
export const WorkflowIdParamSchema = z.object({ id: z.string().uuid() });
export const TicketIdParamSchema = z.object({ id: z.string().uuid() });
export const FormIdParamSchema = z.object({ formId: z.string().uuid() });
export const TicketAndFormParamsSchema = z.object({
  id: z.string().uuid(),
  formId: z.string().uuid(),
});

// ─── Query strings ─────────────────────────────────────────────────────────

export const ListBindingsQuerySchema = z.object({
  stageId: z.string().uuid().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

// ─── Bodies ────────────────────────────────────────────────────────────────

export const CreateStageFormBindingSchema = z.object({
  stageId: z.string().uuid(),
  formId: z.string().uuid(),
  isRequired: z.boolean().default(true),
  position: z.number().int().min(0).max(1000).default(0),
});

export const UpdateStageFormBindingSchema = z
  .object({
    isRequired: z.boolean().optional(),
    position: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'PATCH body must contain at least one field',
  });

/**
 * Body for `POST /api/tickets/:id/forms/:formId/submissions`.
 * Mirrors the standalone submission body shape but carries the workflow
 * context — `bindingId` is the binding row that triggered this fill.
 */
export const CreateWorkflowSubmissionSchema = z.object({
  bindingId: z.string().uuid(),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED']).default('SUBMITTED'),
  responses: z.record(z.unknown()),
  meta: z.record(z.unknown()).optional(),
});

// ─── Inferred types ────────────────────────────────────────────────────────

export type CreateStageFormBindingInput = z.infer<typeof CreateStageFormBindingSchema>;
export type UpdateStageFormBindingInput = z.infer<typeof UpdateStageFormBindingSchema>;
export type CreateWorkflowSubmissionInput = z.infer<typeof CreateWorkflowSubmissionSchema>;
export type ListBindingsQuery = z.infer<typeof ListBindingsQuerySchema>;
