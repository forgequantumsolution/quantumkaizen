import { Router } from 'express';
import * as ctrl from './role.controller';
import {
  CreateRoleSchema,
  IdParamSchema,
  ListQuerySchema,
  SetPermissionsSchema,
  UpdateRoleSchema,
} from './role.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('role.read'), validate(ListQuerySchema, 'query'), asyncHandler(ctrl.list));
// Lightweight role directory (name + user count) for assignment/target pickers.
// Any authenticated user — see role.service.directory. MUST precede '/:id'.
router.get('/directory', asyncHandler(ctrl.directory));
router.get('/:id', requirePermission('role.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/', requirePermission('role.create'), validate(CreateRoleSchema), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  requirePermission('role.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateRoleSchema),
  asyncHandler(ctrl.patch)
);
router.put(
  '/:id/permissions',
  requirePermission('role.update'),
  validate(IdParamSchema, 'params'),
  validate(SetPermissionsSchema),
  asyncHandler(ctrl.setPermissions)
);
router.delete(
  '/:id',
  requirePermission('role.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove)
);

export default router;
