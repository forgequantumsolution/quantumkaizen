/**
 * Training & Competency routes — mounted at /api/training.
 * Reuses the existing TRAINING permission keys: training.read (view + self-
 * complete), training.write (create/edit/assign/delete).
 */
import { Router } from 'express';
import * as ctrl from './training.controller';
import {
  AssignSchema,
  CreateItemSchema,
  IdParamSchema,
  ListItemsQuerySchema,
  UpdateItemSchema,
} from './training.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

router.get('/my', requirePermission('training.read'), asyncHandler(ctrl.myTraining));

router.get('/items', requirePermission('training.read'), validate(ListItemsQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/items/:id', requirePermission('training.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/items', requirePermission('training.write'), validate(CreateItemSchema), asyncHandler(ctrl.create));
router.put('/items/:id', requirePermission('training.write'), validate(IdParamSchema, 'params'), validate(UpdateItemSchema), asyncHandler(ctrl.update));
router.delete('/items/:id', requirePermission('training.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.remove));
router.post('/items/:id/assign', requirePermission('training.write'), validate(IdParamSchema, 'params'), validate(AssignSchema), asyncHandler(ctrl.assign));
router.post('/items/:id/complete', requirePermission('training.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.complete));

export default router;
