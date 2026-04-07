import { Router } from 'express';
import {
  getReviewSummary,
  listMeetings,
  createMeeting,
  addActionItem,
  getReviewPack,
} from '../controllers/managementReview.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/summary', getReviewSummary);
router.get('/meetings', listMeetings);
router.post('/meetings', requireRole('QUALITY_MANAGER', 'TENANT_ADMIN'), createMeeting);
router.post('/meetings/:id/actions', addActionItem);
router.get('/meetings/:id/pack', getReviewPack);

export default router;
