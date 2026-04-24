import { Router } from 'express';
import * as ctrl from './auth.controller';
import { LoginSchema, RegisterSchema } from './auth.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.post('/register', validate(RegisterSchema), asyncHandler(ctrl.register));
router.post('/login', validate(LoginSchema), asyncHandler(ctrl.login));
router.get('/me', requireAuth, asyncHandler(ctrl.me));

export default router;
