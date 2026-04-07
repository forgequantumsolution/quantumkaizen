import { Router } from 'express';
import {
  listPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  assignUsers,
  completeAssignment,
  getCompetencyMatrix,
  getComplianceReport,
} from '../controllers/training.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/competency-matrix', getCompetencyMatrix);
router.get('/compliance-report', getComplianceReport);
router.get('/programs', listPrograms);
router.get('/programs/:id', getProgramById);
router.post('/programs', requireRole('TRAINER', 'QUALITY_MANAGER', 'TENANT_ADMIN'), createProgram);
router.put('/programs/:id', requireRole('TRAINER', 'QUALITY_MANAGER', 'TENANT_ADMIN'), updateProgram);
router.post('/programs/:id/assign', requireRole('TRAINER', 'QUALITY_MANAGER', 'TENANT_ADMIN'), assignUsers);
router.post('/assignments/:id/complete', completeAssignment);

export default router;
