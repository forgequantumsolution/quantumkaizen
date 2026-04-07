import { Router } from 'express';
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  updateSupplierStatus,
  addEvaluation,
} from '../controllers/supplier.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listSuppliers);
router.get('/:id', getSupplierById);
router.post('/', createSupplier);
router.put('/:id', updateSupplier);
router.patch('/:id/status', requireRole('QUALITY_MANAGER', 'TENANT_ADMIN'), updateSupplierStatus);
router.post('/:id/evaluation', addEvaluation);

export default router;
