import { Router } from 'express';
import {
  listChangeRequests,
  getChangeRequestById,
  createChangeRequest,
  updateChangeRequest,
  updateChangeRequestStatus,
  approveChangeRequest,
} from '../controllers/changeControl.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listChangeRequests);
router.get('/:id', getChangeRequestById);
router.post('/', createChangeRequest);
router.put('/:id', updateChangeRequest);
router.patch('/:id/status', updateChangeRequestStatus);
router.post('/:id/approve', requireRole('QUALITY_MANAGER', 'DEPARTMENT_HEAD', 'TENANT_ADMIN'), approveChangeRequest);

export default router;
