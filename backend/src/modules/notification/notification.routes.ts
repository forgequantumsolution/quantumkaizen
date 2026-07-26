/**
 * Notification routes — mounted at `/api/notifications`. Self-scoped: every
 * endpoint operates on the authenticated user's own notifications, so no
 * permission keys beyond `requireAuth` are needed.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from './notification.controller';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';

const IdParamSchema = z.object({ id: z.string().uuid() });

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(ctrl.list));
router.post('/read-all', asyncHandler(ctrl.markAllRead));
router.post('/:id/read', validate(IdParamSchema, 'params'), asyncHandler(ctrl.markRead));

export default router;
