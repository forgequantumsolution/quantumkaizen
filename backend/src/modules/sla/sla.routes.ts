/**
 * SLA module routes.
 *
 * Four routers exported so each surface mounts at its natural path without
 * colliding with existing routers:
 *   - workflowScopedPolicyRouter → /api/workflows  (GET /:id/sla-policies)
 *   - policyRouter               → /api/sla-policies (POST, /:id GET/PATCH/DELETE, /:id/thresholds POST)
 *   - thresholdRouter            → /api/sla-thresholds (/:id DELETE)
 *   - timerRouter                → /api/sla/timers (GET, /:id/extend POST)
 *   - extensionRouter            → /api/sla/extensions (/:id/decide POST)
 *   - ticketScopedSlaRouter      → /api/tickets (GET /:id/sla)
 *
 * SlaTimer rows are not created here — the engine spawns them on stage entry
 * (P3.5). Once that lands, the request/decide extension endpoints below will
 * have real timers to operate on.
 */
import { Router } from 'express';
import * as ctrl from './sla.controller';
import {
  CreateSlaPolicySchema,
  DecideExtensionSchema,
  IdParamSchema,
  ListTimersQuerySchema,
  RequestExtensionSchema,
  UpdateSlaPolicySchema,
  UpsertThresholdsSchema,
} from './sla.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

// ─── /api/workflows/:id/sla-policies (list) ────────────────────────────────

export const workflowScopedPolicyRouter = Router({ mergeParams: true });
workflowScopedPolicyRouter.use(requireAuth);

workflowScopedPolicyRouter.get(
  '/:id/sla-policies',
  requirePermission('sla.policy.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.listPolicies),
);

// ─── /api/sla-policies/:id and POST /api/sla-policies ──────────────────────

export const policyRouter = Router();
policyRouter.use(requireAuth);

policyRouter.post(
  '/',
  requirePermission('sla.policy.create'),
  validate(CreateSlaPolicySchema),
  asyncHandler(ctrl.createPolicy),
);
policyRouter.get(
  '/:id',
  requirePermission('sla.policy.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.getPolicy),
);
policyRouter.patch(
  '/:id',
  requirePermission('sla.policy.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateSlaPolicySchema),
  asyncHandler(ctrl.updatePolicy),
);
policyRouter.delete(
  '/:id',
  requirePermission('sla.policy.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.deletePolicy),
);
policyRouter.post(
  '/:id/thresholds',
  requirePermission('sla.policy.update'),
  validate(IdParamSchema, 'params'),
  validate(UpsertThresholdsSchema),
  asyncHandler(ctrl.upsertThresholds),
);

// ─── /api/sla-thresholds/:id (delete) ──────────────────────────────────────

export const thresholdRouter = Router();
thresholdRouter.use(requireAuth);

thresholdRouter.delete(
  '/:id',
  requirePermission('sla.policy.update'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.deleteThreshold),
);

// ─── /api/sla/timers (dashboard list + extend) ─────────────────────────────

export const timerRouter = Router();
timerRouter.use(requireAuth);

timerRouter.get(
  '/',
  requirePermission('sla.timer.read'),
  validate(ListTimersQuerySchema, 'query'),
  asyncHandler(ctrl.listTimers),
);
timerRouter.post(
  '/:id/extend',
  requirePermission('sla.timer.extend'),
  validate(IdParamSchema, 'params'),
  validate(RequestExtensionSchema),
  asyncHandler(ctrl.requestExtension),
);

// ─── /api/sla/extensions/:id/decide ────────────────────────────────────────

export const extensionRouter = Router();
extensionRouter.use(requireAuth);

extensionRouter.post(
  '/:id/decide',
  requirePermission('sla.timer.extend.approve'),
  validate(IdParamSchema, 'params'),
  validate(DecideExtensionSchema),
  asyncHandler(ctrl.decideExtension),
);

// ─── /api/tickets/:id/sla ──────────────────────────────────────────────────

export const ticketScopedSlaRouter = Router({ mergeParams: true });
ticketScopedSlaRouter.use(requireAuth);

ticketScopedSlaRouter.get(
  '/:id/sla',
  requirePermission('sla.timer.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.getTicketSla),
);
