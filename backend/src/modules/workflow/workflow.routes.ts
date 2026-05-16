import { Router } from 'express';
import * as ctrl from './workflow.controller';
import {
  CreateWorkflowShellSchema,
  DraftBodySchema,
  IdParamSchema,
  ListWorkflowsQuerySchema,
  SaveWorkflowBodySchema,
  SetWorkflowStatusSchema,
} from './workflow.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requirePermission('workflow.read'),
  validate(ListWorkflowsQuerySchema, 'query'),
  asyncHandler(ctrl.list)
);

router.post(
  '/',
  requirePermission('workflow.create'),
  validate(CreateWorkflowShellSchema),
  asyncHandler(ctrl.create)
);

router.get(
  '/:id',
  requirePermission('workflow.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.get)
);

router.put(
  '/:id',
  requirePermission('workflow.update'),
  validate(IdParamSchema, 'params'),
  validate(SaveWorkflowBodySchema),
  asyncHandler(ctrl.save)
);

router.delete(
  '/:id',
  requirePermission('workflow.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove)
);

// Status-only update — Activate / Deactivate without re-running the builder.
// `save()` wipes and rebuilds all stages (cascading approvals/SLA/forms), so
// status changes must NOT go through that path.
router.patch(
  '/:id/status',
  requirePermission('workflow.update'),
  validate(IdParamSchema, 'params'),
  validate(SetWorkflowStatusSchema),
  asyncHandler(ctrl.setStatus)
);

router.post(
  '/:id/draft',
  requirePermission('workflow.update'),
  validate(IdParamSchema, 'params'),
  validate(DraftBodySchema),
  asyncHandler(ctrl.draftSave)
);

router.get(
  '/:id/draft',
  requirePermission('workflow.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.draftGet)
);

router.delete(
  '/:id/draft',
  requirePermission('workflow.update'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.draftDelete)
);

export default router;
