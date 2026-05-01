import { Router } from 'express';
import * as ctrl from './permission.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(ctrl.list));

export default router;
