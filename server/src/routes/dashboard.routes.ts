import { Router } from 'express';
import {
  getStats,
  getRecentActivity,
  getNCTrends,
  getNCByType,
  getNCBySeverity,
} from '../controllers/dashboard.controller.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/stats', getStats);
router.get('/recent-activity', getRecentActivity);
router.get('/nc-trends', getNCTrends);
router.get('/nc-by-type', getNCByType);
router.get('/nc-by-severity', getNCBySeverity);

export default router;
