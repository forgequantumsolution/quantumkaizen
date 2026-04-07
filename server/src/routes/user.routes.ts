import { Router } from 'express';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
} from '../controllers/user.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listUsers);
router.get('/:id', getUserById);
router.post('/', requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), createUser);
router.put('/:id', updateUser);
router.patch('/:id/status', requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), updateUserStatus);

export default router;
