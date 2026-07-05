import { Router } from 'express';
import * as ctrl from './user.controller';
import {
  CreateUserSchema,
  IdParamSchema,
  ListQuerySchema,
  ResetPasswordSchema,
  SetOverridesSchema,
  UpdateUserSchema,
} from './user.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('user.read'), validate(ListQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', requirePermission('user.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/', requirePermission('user.create'), validate(CreateUserSchema), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  requirePermission('user.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateUserSchema),
  asyncHandler(ctrl.patch)
);
router.post(
  '/:id/reset-password',
  requirePermission('user.update'),
  validate(IdParamSchema, 'params'),
  validate(ResetPasswordSchema),
  asyncHandler(ctrl.resetPassword)
);
router.get(
  '/:id/permissions',
  requirePermission('user.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.getPermissions)
);
router.put(
  '/:id/permissions',
  requirePermission('user.update'),
  validate(IdParamSchema, 'params'),
  validate(SetOverridesSchema),
  asyncHandler(ctrl.setPermissions)
);
router.delete(
  '/:id',
  requirePermission('user.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove)
);

export default router;
