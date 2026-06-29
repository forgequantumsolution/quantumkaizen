/** LIMS 2.0 — QC (Levey-Jennings / Westgard), mounted at /api/qc. */
import { Router } from 'express';
import * as ctrl from './qc.controller';
import { QcMaterialUpsertSchema, RecordQcResultSchema, ListQcMaterialQuerySchema, IdParamSchema } from './qc.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

router.get('/materials', requirePermission('qc.read'), validate(ListQcMaterialQuerySchema, 'query'), asyncHandler(ctrl.list));
router.post('/materials', requirePermission('qc.create'), validate(QcMaterialUpsertSchema), asyncHandler(ctrl.create));
router.put('/materials/:id', requirePermission('qc.update'), validate(IdParamSchema, 'params'), validate(QcMaterialUpsertSchema), asyncHandler(ctrl.update));
router.delete('/materials/:id', requirePermission('qc.update'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.remove));
router.get('/materials/:id/chart', requirePermission('qc.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.chart));
router.post('/materials/:id/results', requirePermission('qc.result'), validate(IdParamSchema, 'params'), validate(RecordQcResultSchema), asyncHandler(ctrl.record));

export default router;
