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
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

// Sites are organizational data, so we reuse the existing `org.read` /
// `org.update` permission keys instead of minting new ones. This keeps
// permission seeds compatible without a re-run.
const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('org.read'), validate(ListQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', requirePermission('org.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/', requirePermission('org.update'), validate(CreateSiteSchema), asyncHandler(ctrl.create));
router.patch(
  '/:id',
  requirePermission('org.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateSiteSchema),
  asyncHandler(ctrl.patch),
);
router.delete(
  '/:id',
  requirePermission('org.update'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove),
);

export default router;
