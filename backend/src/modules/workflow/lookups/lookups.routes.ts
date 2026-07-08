import { Router } from 'express';
import * as ctrl from './lookups.controller';
import {
  CreateNamedSchema,
  CreateSeveritySchema,
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
// The type LIST is navigation metadata (module names/ids/icons) that the sidebar
// needs to render a user's workflow modules — so it's readable by any
// authenticated user. Requiring `workflow.lookups.read` (a Configuration-admin
// permission) here would hide EVERY workflow module from anyone who only has
// per-type ticket access. Create/delete below stay gated on `workflow.lookups.manage`.
router.get('/types', asyncHandler(ctrl.listTypes));
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

// Severity — industry-standard impact classification (Critical/Major/Minor).
// Lives under workflow lookups because it's a small named lookup like the
// others, and reuses the same `workflow.lookups.*` permissions.
router.get(
  '/severities',
  requirePermission('workflow.lookups.read'),
  asyncHandler(ctrl.listSeverities)
);
router.post(
  '/severities',
  requirePermission('workflow.lookups.manage'),
  validate(CreateSeveritySchema),
  asyncHandler(ctrl.createSeverity)
);
router.delete(
  '/severities/:id',
  requirePermission('workflow.lookups.manage'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.deleteSeverity)
);

export default router;
