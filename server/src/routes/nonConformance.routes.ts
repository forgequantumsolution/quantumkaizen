import { Router } from 'express';
import {
  listNonConformances,
  getNonConformanceById,
  createNonConformance,
  updateNonConformance,
  updateNCStatus,
  addContainment,
  addRootCause,
  setDisposition,
  closeNonConformance,
  linkCAPA,
} from '../controllers/nonConformance.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listNonConformances);
router.get('/:id', getNonConformanceById);
router.post('/', createNonConformance);
router.put('/:id', updateNonConformance);
router.patch('/:id/status', updateNCStatus);
router.post('/:id/containment', addContainment);
router.post('/:id/root-cause', addRootCause);
router.post('/:id/disposition', setDisposition);
router.post('/:id/close', requireRole('QUALITY_MANAGER', 'TENANT_ADMIN'), closeNonConformance);
router.post('/:id/link-capa', linkCAPA);

export default router;
