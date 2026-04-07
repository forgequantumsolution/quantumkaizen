import { Router } from 'express';
import {
  listRequirements,
  getRequirementById,
  createRequirement,
  updateRequirement,
  getComplianceSummary,
} from '../controllers/compliance.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/summary', getComplianceSummary);
router.get('/', listRequirements);
router.get('/:id', getRequirementById);
router.post('/', createRequirement);
router.put('/:id', updateRequirement);

export default router;
