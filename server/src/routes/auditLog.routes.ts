import { Router } from 'express';
import { queryAuditLog } from '../controllers/auditLog.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
router.use(requireRole('QUALITY_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'));

router.get('/', queryAuditLog);

export default router;
