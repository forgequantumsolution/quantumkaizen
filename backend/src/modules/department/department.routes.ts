import { Router } from 'express';
import * as ctrl from './department.controller';
import {
  CreateDepartmentSchema,
  IdParamSchema,
  ListQuerySchema,
  SetPermissionsSchema,
  UpdateDepartmentSchema,
} from './department.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

// The department list/tree is org reference data that operational forms need
// as a picker (ticket department, CAPA department, audit scope, doc owner).
// Readable by any authenticated user — gating it behind `department.read`
// empties those pickers for operational roles that legitimately assign a
// department. Detail (`/:id`) and mutations stay gated.
router.get('/tree', asyncHandler(ctrl.tree));
router.get('/', validate(ListQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', requirePermission('department.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/', requirePermission('department.create'), validate(CreateDepartmentSchema), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  requirePermission('department.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateDepartmentSchema),
  asyncHandler(ctrl.patch)
);
router.put(
  '/:id/permissions',
  requirePermission('department.update'),
  validate(IdParamSchema, 'params'),
  validate(SetPermissionsSchema),
  asyncHandler(ctrl.setPermissions)
);
router.delete(
  '/:id',
  requirePermission('department.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove)
);

export default router;
