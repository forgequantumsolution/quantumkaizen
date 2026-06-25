/**
 * LIMS 2.0 — sample testing & worklists, mounted at /api/testing.
 */
import { Router } from 'express';
import * as ctrl from './sample-testing.controller';
import {
  AssignTestsSchema, EnterResultsSchema, ReviewTestSchema, DisposeSampleSchema,
  WorklistUpsertSchema, ListSampleTestQuerySchema, ListWorklistQuerySchema, IdParamSchema,
} from './sample-testing.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

// Worklists (declare before /:id-style test routes to avoid shadowing)
router.get('/worklists', requirePermission('worklist.read'), validate(ListWorklistQuerySchema, 'query'), asyncHandler(ctrl.listWorklists));
router.post('/worklists', requirePermission('worklist.create'), validate(WorklistUpsertSchema), asyncHandler(ctrl.createWorklist));
router.get('/worklists/:id', requirePermission('worklist.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getWorklist));
router.put('/worklists/:id', requirePermission('worklist.update'), validate(IdParamSchema, 'params'), validate(WorklistUpsertSchema), asyncHandler(ctrl.updateWorklist));
router.post('/worklists/:id/close', requirePermission('worklist.update'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.closeWorklist));

// Sample tests
router.get('/tests', requirePermission('result.read'), validate(ListSampleTestQuerySchema, 'query'), asyncHandler(ctrl.listTests));
router.get('/tests/:id', requirePermission('result.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getTest));
router.post('/tests/:id/results', requirePermission('result.enter'), validate(IdParamSchema, 'params'), validate(EnterResultsSchema), asyncHandler(ctrl.enterResults));
router.post('/tests/:id/review', requirePermission('result.review'), validate(IdParamSchema, 'params'), validate(ReviewTestSchema), asyncHandler(ctrl.reviewTest));
router.delete('/tests/:id/worklist', requirePermission('worklist.update'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.removeTestFromWorklist));

// Sample-scoped (mounted by sample id)
router.get('/samples/:id/tests', requirePermission('result.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.testsForSample));
router.post('/samples/:id/assign', requirePermission('result.enter'), validate(IdParamSchema, 'params'), validate(AssignTestsSchema), asyncHandler(ctrl.assign));
router.post('/samples/:id/dispose', requirePermission('sample.dispose'), validate(IdParamSchema, 'params'), validate(DisposeSampleSchema), asyncHandler(ctrl.dispose));

export default router;
