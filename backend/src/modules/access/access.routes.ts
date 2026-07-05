import { Router } from 'express';
import * as ctrl from './access.controller';
import { PermissionKeyParamSchema } from './access.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get(
  '/who-can/:permissionKey',
  requirePermission('role.read'),
  validate(PermissionKeyParamSchema, 'params'),
  asyncHandler(ctrl.whoCan)
);

export default router;
