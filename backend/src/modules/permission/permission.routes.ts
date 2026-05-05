import { Router } from 'express';
import * as ctrl from './permission.controller';
import { ListQuerySchema } from './permission.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', validate(ListQuerySchema, 'query'), asyncHandler(ctrl.list));

export default router;
