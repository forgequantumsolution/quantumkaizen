import { Router } from 'express';
import {
  listComplaints,
  getComplaintById,
  createComplaint,
  updateComplaint,
  updateComplaintStatus,
  addResolution,
} from '../controllers/complaint.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listComplaints);
router.get('/:id', getComplaintById);
router.post('/', createComplaint);
router.put('/:id', updateComplaint);
router.patch('/:id/status', updateComplaintStatus);
router.post('/:id/resolution', addResolution);

export default router;
