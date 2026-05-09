import { Router } from 'express';
import * as ctrl from './lookups.controller';
import {
  CreateNamedSchema,
  CreateStageStatusSchema,
  CreateWorkflowTypeSchema,
  IdParamSchema,
} from './lookups.schema';
import { validate } from '../../../middleware/validate';
import { requireAuth } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/permissions';
import { asyncHandler } from '../../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

// WorkflowType
router.get('/types', requirePermission('workflow.lookups.read'), asyncHandler(ctrl.listTypes));
router.post(
  '/types',
  requirePermission('workflow.lookups.manage'),
  validate(CreateWorkflowTypeSchema),
  asyncHandler(ctrl.createType)
);
router.delete(
  '/types/:id',
  requirePermission('workflow.lookups.manage'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.deleteType)
);

// StageStatus
router.get(
  '/stage-statuses',
  requirePermission('workflow.lookups.read'),
  asyncHandler(ctrl.listStageStatuses)
);
router.post(
  '/stage-statuses',
  requirePermission('workflow.lookups.manage'),
  validate(CreateStageStatusSchema),
  asyncHandler(ctrl.createStageStatus)
);

// ActionType
router.get(
  '/action-types',
  requirePermission('workflow.lookups.read'),
  asyncHandler(ctrl.listActionTypes)
);
router.post(
  '/action-types',
  requirePermission('workflow.lookups.manage'),
  validate(CreateNamedSchema),
  asyncHandler(ctrl.createActionType)
);

// ActionCriteria
router.get(
  '/action-criteria',
  requirePermission('workflow.lookups.read'),
  asyncHandler(ctrl.listActionCriteria)
);
router.post(
  '/action-criteria',
  requirePermission('workflow.lookups.manage'),
  validate(CreateNamedSchema),
  asyncHandler(ctrl.createActionCriteria)
);

// Priority
router.get(
  '/priorities',
  requirePermission('workflow.lookups.read'),
  asyncHandler(ctrl.listPriorities)
);

export default router;
