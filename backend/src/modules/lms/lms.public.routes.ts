/** LMS — public certificate verification (NO auth), mounted at /api/public/lms. */
import { Router } from 'express';
import * as ctrl from './lms.controller';
import { TokenParamSchema } from './lms.schema';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.get('/certificates/verify/:token', validate(TokenParamSchema, 'params'), asyncHandler(ctrl.verifyCertificate));
export default router;
