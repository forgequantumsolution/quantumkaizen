/** Sidebar notification counts. Mounted at /api/nav-counts. */
import { Router } from 'express';
import * as ctrl from './nav-counts.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

// Authenticated-only; no extra permission — badges reflect whatever the user
// can already navigate to. Counts themselves are non-sensitive aggregates.
router.get('/', asyncHandler(ctrl.navCounts));

export default router;
