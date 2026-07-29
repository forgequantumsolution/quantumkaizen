import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from './nav-group.controller';
import { SaveNavGroupsSchema } from './nav-group.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

// The layout is navigation metadata (which group each module renders under) that
// EVERY user needs to draw their own sidebar — so it is readable by any
// authenticated user, exactly like /workflow-lookups/types. Gating it behind the
// admin key would leave non-admins with an ungrouped sidebar. Grouping grants no
// access of its own: what a user can actually see is still decided by the
// per-module permission keys on the client and by each module's own API guards.
router.get('/', asyncHandler(ctrl.list));

router.put(
  '/',
  requirePermission('nav.groups.manage'),
  validate(SaveNavGroupsSchema),
  asyncHandler(ctrl.save),
);

router.delete(
  '/:id',
  requirePermission('nav.groups.manage'),
  validate(z.object({ id: z.string().uuid() }), 'params'),
  asyncHandler(ctrl.remove),
);

export default router;
