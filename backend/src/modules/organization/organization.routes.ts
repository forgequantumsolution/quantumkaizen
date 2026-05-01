import { Router } from 'express';
import * as ctrl from './organization.controller';
import { UpdateOrganizationSchema } from './organization.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/industries', asyncHandler(ctrl.industries));
router.get('/', requirePermission('org.read'), asyncHandler(ctrl.get));
router.put('/', requirePermission('org.update'), validate(UpdateOrganizationSchema), asyncHandler(ctrl.put));

export default router;
