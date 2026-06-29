/**
 * LIMS 2.0 — L1 Spec Version routes, mounted centrally at /api/spec-versions.
 *   GET    /            list (spec_version.read)
 *   GET    /:id         detail (spec_version.read)
 *   POST   /            create draft (spec_version.create)
 *   PUT    /:id         update draft (spec_version.update)
 *   POST   /:id/approve approve draft → APPROVED (spec_version.approve)
 *   POST   /:id/revise  clone approved → new draft (spec_version.update)
 *   DELETE /:id         soft-delete (spec_version.delete)
 */
import { Router } from 'express';
import * as ctrl from './spec-version.controller';
import { IdParamSchema, ListSpecVersionQuerySchema, SpecVersionUpsertSchema } from './spec-version.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('spec_version.read'), validate(ListSpecVersionQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', requirePermission('spec_version.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/', requirePermission('spec_version.create'), validate(SpecVersionUpsertSchema), asyncHandler(ctrl.create));
router.put('/:id', requirePermission('spec_version.update'), validate(IdParamSchema, 'params'), validate(SpecVersionUpsertSchema), asyncHandler(ctrl.update));
router.post('/:id/approve', requirePermission('spec_version.approve'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.approve));
router.post('/:id/revise', requirePermission('spec_version.update'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.revise));
router.delete('/:id', requirePermission('spec_version.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.remove));

export default router;
