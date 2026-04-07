import { Router } from 'express';
import { register, login, refresh, logout, me } from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', verifyToken, register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', verifyToken, logout);
router.get('/me', verifyToken, me);

export default router;
