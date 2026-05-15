import { Router } from 'express';
import * as ctrl from './workflow.controller';
import {
  CreateWorkflowShellSchema,
  DraftBodySchema,
  IdParamSchema,
  ListWorkflowsQuerySchema,
  SaveWorkflowBodySchema,
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

export default router;
