/**
 * LIMS Sample lifecycle routes — mounted at /api/samples.
 *   /storage-locations …                  storage master
 *   /                                      register + list
 *   /:id  /:id/transition  /:id/custody  /:id/aliquots
 */
import { Router } from 'express';
import * as ctrl from './sample.controller';
import {
  AddAliquotSchema, AddCustodySchema, IdParamSchema, ListSampleQuerySchema, ListStorageQuerySchema,
  RegisterSampleSchema, StorageUpsertSchema, TransitionSampleSchema, UpdateSampleSchema,
} from './sample.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

// ── Storage locations ──
router.get('/storage-locations', requirePermission('storage.read'), validate(ListStorageQuerySchema, 'query'), asyncHandler(ctrl.listStorage));
router.post('/storage-locations', requirePermission('storage.create'), validate(StorageUpsertSchema), asyncHandler(ctrl.createStorage));
router.put('/storage-locations/:id', requirePermission('storage.update'), validate(IdParamSchema, 'params'), validate(StorageUpsertSchema), asyncHandler(ctrl.updateStorage));
router.delete('/storage-locations/:id', requirePermission('storage.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.removeStorage));

// ── Samples ──
router.get('/', requirePermission('sample.read'), validate(ListSampleQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', requirePermission('sample.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/', requirePermission('sample.create'), validate(RegisterSampleSchema), asyncHandler(ctrl.register));
router.put('/:id', requirePermission('sample.update'), validate(IdParamSchema, 'params'), validate(UpdateSampleSchema), asyncHandler(ctrl.update));
router.post('/:id/transition', requirePermission('sample.update'), validate(IdParamSchema, 'params'), validate(TransitionSampleSchema), asyncHandler(ctrl.transition));
router.post('/:id/custody', requirePermission('sample.update'), validate(IdParamSchema, 'params'), validate(AddCustodySchema), asyncHandler(ctrl.addCustody));
router.post('/:id/aliquots', requirePermission('sample.update'), validate(IdParamSchema, 'params'), validate(AddAliquotSchema), asyncHandler(ctrl.addAliquot));
router.delete('/:id', requirePermission('sample.update'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.remove));

export default router;
