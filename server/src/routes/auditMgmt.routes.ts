import { Router } from 'express';
import {
  listAudits,
  getAuditById,
  createAudit,
  updateAudit,
  addFinding,
  completeAudit,
  closeAudit,
} from '../controllers/audit.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listAudits);
router.get('/:id', getAuditById);
router.post('/', requireRole('AUDITOR', 'QUALITY_MANAGER', 'TENANT_ADMIN'), createAudit);
router.put('/:id', updateAudit);
router.post('/:id/findings', requireRole('AUDITOR', 'QUALITY_MANAGER', 'TENANT_ADMIN'), addFinding);
router.post('/:id/complete', requireRole('AUDITOR', 'QUALITY_MANAGER', 'TENANT_ADMIN'), completeAudit);
router.post('/:id/close', requireRole('QUALITY_MANAGER', 'TENANT_ADMIN'), closeAudit);

export default router;
