/** Global cross-module search. Mounted at /api/search. */
import { Router } from 'express';
import * as ctrl from './search.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(ctrl.search));

export default router;
