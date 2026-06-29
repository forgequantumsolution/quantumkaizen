/** LIMS 2.0 — Stability (ICH Q1A), mounted at /api/stability. */
import { Router } from 'express';
import * as ctrl from './stability.controller';
import { StudyUpsertSchema, ConditionSchema, ActivateSchema, ListStudyQuerySchema, IdParamSchema } from './stability.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('stability.read'), validate(ListStudyQuerySchema, 'query'), asyncHandler(ctrl.list));
router.post('/', requirePermission('stability.create'), validate(StudyUpsertSchema), asyncHandler(ctrl.create));
router.get('/:id', requirePermission('stability.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.put('/:id', requirePermission('stability.update'), validate(IdParamSchema, 'params'), validate(StudyUpsertSchema), asyncHandler(ctrl.update));
router.post('/:id/conditions', requirePermission('stability.update'), validate(IdParamSchema, 'params'), validate(ConditionSchema), asyncHandler(ctrl.addCondition));
router.post('/:id/activate', requirePermission('stability.update'), validate(IdParamSchema, 'params'), validate(ActivateSchema), asyncHandler(ctrl.activate));
router.post('/:id/complete', requirePermission('stability.update'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.complete));
// :id here is the pull id
router.post('/pulls/:id/pull', requirePermission('stability.execute'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.pull));

export default router;
