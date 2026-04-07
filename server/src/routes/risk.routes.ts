import { Router } from 'express';
import {
  listRisks,
  getRiskById,
  createRisk,
  updateRisk,
  addControlMeasure,
  updateResidualRisk,
  getHeatmap,
} from '../controllers/risk.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/heatmap', getHeatmap);
router.get('/', listRisks);
router.get('/:id', getRiskById);
router.post('/', createRisk);
router.put('/:id', updateRisk);
router.post('/:id/controls', addControlMeasure);
router.post('/:id/residual', updateResidualRisk);

export default router;
