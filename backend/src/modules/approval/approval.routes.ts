/**
 * Approval module routes.
 *
 * Three routers exported so the API surface mounts cleanly:
 *   - workflowScopedPolicyRouter → mounted at /api/workflows (LIST + CREATE policies for a workflow)
 *   - policyRouter               → mounted at /api/approval-policies (GET/PATCH/DELETE by policy id)
 *   - instanceRouter             → mounted at /api/approvals (GET an instance by id)
 *   - ticketScopedInstanceRouter → mounted at /api/tickets (LIST a ticket's approval instances)
 *
 * The `/decide` endpoint is intentionally NOT registered here — it requires
 * `engine/approval.layer.ts` (P3.5). The endpoint will be added under
 * /api/approvals/:instanceId/decide once the engine intercept exists.
 */
import { Router } from 'express';
import * as ctrl from './approval.controller';
import {
  CreateApprovalPolicySchema,
  DecideApprovalSchema,
  IdParamSchema,
  InstanceIdParamSchema,
  UpdateApprovalPolicySchema,
} from './approval.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

// ─── Workflow-scoped: list / create policies on a workflow ─────────────────

export const workflowScopedPolicyRouter = Router({ mergeParams: true });
workflowScopedPolicyRouter.use(requireAuth);

workflowScopedPolicyRouter.get(
  '/:id/approval-policies',
  requirePermission('approval.policy.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.listPolicies),
);
workflowScopedPolicyRouter.post(
  '/:id/approval-policies',
  requirePermission('approval.policy.create'),
  validate(IdParamSchema, 'params'),
  validate(CreateApprovalPolicySchema),
  asyncHandler(ctrl.createPolicy),
);

// ─── /api/approval-policies/:id ────────────────────────────────────────────

export const policyRouter = Router();
policyRouter.use(requireAuth);

policyRouter.get(
  '/:id',
  requirePermission('approval.policy.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.getPolicy),
);
policyRouter.patch(
  '/:id',
  requirePermission('approval.policy.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateApprovalPolicySchema),
  asyncHandler(ctrl.updatePolicy),
);
policyRouter.delete(
  '/:id',
  requirePermission('approval.policy.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.deletePolicy),
);

// ─── /api/approvals/:instanceId — single-instance read ────────────────────

export const instanceRouter = Router();
instanceRouter.use(requireAuth);

instanceRouter.get(
  '/:instanceId',
  requirePermission('approval.read'),
  validate(InstanceIdParamSchema, 'params'),
  asyncHandler(ctrl.getInstance),
);

// Phase 3 — Approval decide endpoint. Wired in P3.5 (needs engine intercept).
instanceRouter.post(
  '/:instanceId/decide',
  requirePermission('approval.decide'),
  validate(InstanceIdParamSchema, 'params'),
  validate(DecideApprovalSchema),
  asyncHandler(ctrl.decideInstance),
);

// ─── /api/tickets/:id/approvals — list instances for a ticket ─────────────

export const ticketScopedInstanceRouter = Router({ mergeParams: true });
ticketScopedInstanceRouter.use(requireAuth);

ticketScopedInstanceRouter.get(
  '/:id/approvals',
  requirePermission('approval.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.listTicketApprovals),
);
