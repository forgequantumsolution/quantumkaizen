/** LIMS 2.0 — analytics: dashboard, TAT, workload, data-review. Mounted at /api/lims-analytics. */
import { Router } from 'express';
import * as ctrl from './lims-analytics.controller';
import { AuditReviewQuerySchema } from './lims-analytics.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', requirePermission('lims_dashboard.read'), asyncHandler(ctrl.dashboard));
router.get('/tat', requirePermission('lims_dashboard.read'), asyncHandler(ctrl.tat));
router.get('/workload', requirePermission('lims_dashboard.read'), asyncHandler(ctrl.workload));
router.get('/audit-review', requirePermission('data_review.read'), validate(AuditReviewQuerySchema, 'query'), asyncHandler(ctrl.auditReview));
router.get('/audit-entity-types', requirePermission('data_review.read'), asyncHandler(ctrl.auditEntityTypes));

export default router;
