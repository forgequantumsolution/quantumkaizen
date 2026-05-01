import { Router } from 'express';
import * as ctrl from './department.controller';
import {
  CreateDepartmentSchema,
  IdParamSchema,
  ListQuerySchema,
  UpdateDepartmentSchema,
} from './department.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/tree', requirePermission('department.read'), asyncHandler(ctrl.tree));
router.get('/', requirePermission('department.read'), validate(ListQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', requirePermission('department.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/', requirePermission('department.create'), validate(CreateDepartmentSchema), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  requirePermission('department.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateDepartmentSchema),
  asyncHandler(ctrl.patch)
);
router.delete(
  '/:id',
  requirePermission('department.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove)
);

export default router;
