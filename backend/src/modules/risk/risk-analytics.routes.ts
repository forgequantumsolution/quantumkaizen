/**
 * Risk Management analytics routes — mounted under /api/risk, so the paths here
 * are relative (`/analytics/...`). All three are read-only views over the risk
 * register and carry the single `risk.read` key.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './risk-analytics.controller';
import { ByCategoryQuerySchema, OverdueQuerySchema, TrendQuerySchema } from './risk-analytics.schema';

const router = Router();

router.use(requireAuth);

router.get('/analytics/trend', requirePermission('risk.read'), validate(TrendQuerySchema, 'query'), asyncHandler(ctrl.getTrend));
router.get('/analytics/overdue', requirePermission('risk.read'), validate(OverdueQuerySchema, 'query'), asyncHandler(ctrl.getOverdue));
router.get('/analytics/by-category', requirePermission('risk.read'), validate(ByCategoryQuerySchema, 'query'), asyncHandler(ctrl.getByCategory));

export default router;
