/**
 * StageFormBinding routes (Phase 3.5).
 *
 * Mounted as four routers so they slot into existing URL spaces cleanly:
 *   - workflowScopedBindingRouter  → /api/workflows  (GET, POST /:id/stage-form-bindings)
 *   - bindingRouter                → /api/stage-form-bindings  (GET, PATCH, DELETE /:id)
 *   - ticketScopedFormsRouter      → /api/tickets  (GET /:id/stage-forms)
 *   - ticketScopedSubmissionRouter → /api/tickets  (POST /:id/forms/:formId/submissions)
 */
import { Router } from 'express';
import * as ctrl from './stage-form.controller';
import {
  CreateStageFormBindingSchema,
  CreateWorkflowSubmissionSchema,
  IdParamSchema,
  ListBindingsQuerySchema,
  TicketAndFormParamsSchema,
  TicketIdParamSchema,
  UpdateStageFormBindingSchema,
  WorkflowIdParamSchema,
} from './stage-form.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission, requireTicketAction } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

// ─── /api/workflows/:id/stage-form-bindings — list + create ────────────────

export const workflowScopedBindingRouter = Router({ mergeParams: true });
workflowScopedBindingRouter.use(requireAuth);

workflowScopedBindingRouter.get(
  '/:id/stage-form-bindings',
  requirePermission('stage-form.read'),
  validate(WorkflowIdParamSchema, 'params'),
  validate(ListBindingsQuerySchema, 'query'),
  asyncHandler(ctrl.listForWorkflow),
);
workflowScopedBindingRouter.post(
  '/:id/stage-form-bindings',
  requirePermission('stage-form.create'),
  validate(WorkflowIdParamSchema, 'params'),
  validate(CreateStageFormBindingSchema),
  asyncHandler(ctrl.create),
);

// ─── /api/stage-form-bindings/:id — read, update, delete ───────────────────

export const bindingRouter = Router();
bindingRouter.use(requireAuth);

bindingRouter.get(
  '/:id',
  requirePermission('stage-form.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.get),
);
bindingRouter.patch(
  '/:id',
  requirePermission('stage-form.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateStageFormBindingSchema),
  asyncHandler(ctrl.update),
);
bindingRouter.delete(
  '/:id',
  requirePermission('stage-form.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove),
);

// ─── /api/tickets/:id/stage-forms — bindings + latest-submission view ──────

export const ticketScopedFormsRouter = Router({ mergeParams: true });
ticketScopedFormsRouter.use(requireAuth);

ticketScopedFormsRouter.get(
  '/:id/stage-forms',
  requireTicketAction('read'),
  validate(TicketIdParamSchema, 'params'),
  asyncHandler(ctrl.listForTicket),
);

// Read-only history of every submitted form/checklist across all stages —
// keeps filled forms viewable after the ticket leaves a stage or completes.
ticketScopedFormsRouter.get(
  '/:id/form-submissions',
  requireTicketAction('read'),
  validate(TicketIdParamSchema, 'params'),
  asyncHandler(ctrl.listSubmittedForms),
);

// ─── /api/tickets/:id/forms/:formId/submissions — workflow-bound POST ──────

export const ticketScopedSubmissionRouter = Router({ mergeParams: true });
ticketScopedSubmissionRouter.use(requireAuth);

ticketScopedSubmissionRouter.post(
  '/:id/forms/:formId/submissions',
  // form_submission.create is the existing perm for filling forms; the
  // service additionally enforces ticket reachability.
  requirePermission('form_submission.create'),
  validate(TicketAndFormParamsSchema, 'params'),
  validate(CreateWorkflowSubmissionSchema),
  asyncHandler(ctrl.createWorkflowSubmission),
);
