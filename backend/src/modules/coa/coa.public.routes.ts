/** LIMS 2.0 — public CoA verification (NO auth), mounted at /api/public/coa. */
import { Router } from 'express';
import * as ctrl from './coa.controller';
import { TokenParamSchema } from './coa.schema';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.get('/verify/:token', validate(TokenParamSchema, 'params'), asyncHandler(ctrl.verify));
export default router;
