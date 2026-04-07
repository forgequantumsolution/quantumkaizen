import { Router } from 'express';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markAsRead);
router.post('/mark-all-read', markAllAsRead);

export default router;
