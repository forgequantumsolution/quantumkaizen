/** Quality Command Center — role-aware, org-scoped dashboard. Mounted at /api/dashboard. */
import { Router } from 'express';
import * as ctrl from './dashboard.controller';
import { OverviewQuerySchema } from './dashboard.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

// Panels are gated per-persona/permission inside the service, so any
// authenticated user may call this — they simply get their own layout.
router.get('/overview', validate(OverviewQuerySchema, 'query'), asyncHandler(ctrl.overview));

export default router;
