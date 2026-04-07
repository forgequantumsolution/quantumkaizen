import { Router } from 'express';
import {
  listFMEAs,
  getFMEAById,
  createFMEA,
  addFailureMode,
  updateFailureMode,
} from '../controllers/fmea.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listFMEAs);
router.get('/:id', getFMEAById);
router.post('/', createFMEA);
router.post('/:id/failure-modes', addFailureMode);
router.put('/:id/failure-modes/:fmId', updateFailureMode);

export default router;
