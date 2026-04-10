import { Router } from 'express';
import { getNCTrends, getHeatmap, getKpiComparison, getAuditVolume } from '../controllers/analytics.controller.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/nc-trends', getNCTrends);
router.get('/heatmap', getHeatmap);
router.get('/kpi-comparison', getKpiComparison);
router.get('/audit-volume', getAuditVolume);

export default router;
