import { Router } from 'express';
import {
  listCAPAs,
  getCAPAById,
  createCAPA,
  updateCAPA,
  updateCAPAStatus,
  addCAPAAction,
  updateCAPAActionStatus,
  recordEffectiveness,
  closeCAPA,
} from '../controllers/capa.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listCAPAs);
router.get('/:id', getCAPAById);
router.post('/', createCAPA);
router.put('/:id', updateCAPA);
router.patch('/:id/status', updateCAPAStatus);
router.post('/:id/actions', addCAPAAction);
router.patch('/:id/actions/:actionId', updateCAPAActionStatus);
router.post('/:id/effectiveness', recordEffectiveness);
router.post('/:id/close', requireRole('QUALITY_MANAGER', 'TENANT_ADMIN'), closeCAPA);

export default router;
