import { Router } from 'express';
import * as ctrl from './site.controller';
import {
  CreateSiteSchema,
  IdParamSchema,
  ListQuerySchema,
  UpdateSiteSchema,
} from './site.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission, requireAnyPermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

// Facilities are their own configurable module (Configuration → Facilities in
// Access Control), gated by granular `site.*` CRUD keys. The list/detail reads
// also accept the broader `org.read` so operational pickers (ticket site
// selector, LMS targeting) — held by roles without `site.read` — keep working.
const router = Router();

router.use(requireAuth);

router.get('/', requireAnyPermission('site.read', 'org.read'), validate(ListQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', requireAnyPermission('site.read', 'org.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/', requirePermission('site.create'), validate(CreateSiteSchema), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  requirePermission('site.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateSiteSchema),
  asyncHandler(ctrl.patch),
);
router.delete(
  '/:id',
  requirePermission('site.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove),
);

export default router;
