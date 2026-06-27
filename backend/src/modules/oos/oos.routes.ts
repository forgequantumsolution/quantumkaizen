/**
 * LIMS 2.0 — OOS/OOT investigations, mounted at /api/oos.
 */
import { Router } from 'express';
import * as ctrl from './oos.controller';
import { OpenInvestigationSchema, UpdateInvestigationSchema, AdvancePhaseSchema, CloseInvestigationSchema, CreateCapaFromOosSchema, ListInvestigationQuerySchema, IdParamSchema } from './oos.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('oos.read'), validate(ListInvestigationQuerySchema, 'query'), asyncHandler(ctrl.list));
router.post('/', requirePermission('oos.create'), validate(OpenInvestigationSchema), asyncHandler(ctrl.open));
router.get('/:id', requirePermission('oos.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.put('/:id', requirePermission('oos.update'), validate(IdParamSchema, 'params'), validate(UpdateInvestigationSchema), asyncHandler(ctrl.update));
router.post('/:id/advance', requirePermission('oos.update'), validate(IdParamSchema, 'params'), validate(AdvancePhaseSchema), asyncHandler(ctrl.advance));
router.post('/:id/close', requirePermission('oos.close'), validate(IdParamSchema, 'params'), validate(CloseInvestigationSchema), asyncHandler(ctrl.close));
// LIMS → QMS: raise a CAPA from this investigation (needs CAPA-create rights).
router.post('/:id/capa', requirePermission('capa.create'), validate(IdParamSchema, 'params'), validate(CreateCapaFromOosSchema), asyncHandler(ctrl.createCapa));

export default router;
