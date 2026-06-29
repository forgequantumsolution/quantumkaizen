/**
 * Test Definitions & Test Panels routes — mounted at /api/test-definitions.
 *   GET/POST           /                (test definitions)
 *   GET/PUT/DELETE     /:id
 *   POST               /:id/approve
 *   GET                /panels/all      (test panels)
 *   GET/PUT/DELETE     /panels/:id
 *   POST               /panels
 */
import { Router } from 'express';
import * as ctrl from './test-definition.controller';
import {
  IdParamSchema,
  ListTestDefinitionQuerySchema,
  TestDefinitionUpsertSchema,
  ListTestPanelQuerySchema,
  TestPanelUpsertSchema,
} from './test-definition.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

// ── Test Panels (declared before '/:id' to avoid shadowing) ──
router.get('/panels/all', requirePermission('test_panel.read'), validate(ListTestPanelQuerySchema, 'query'), asyncHandler(ctrl.listPanels));
router.get('/panels/:id', requirePermission('test_panel.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getPanel));
router.post('/panels', requirePermission('test_panel.create'), validate(TestPanelUpsertSchema), asyncHandler(ctrl.createPanel));
router.put('/panels/:id', requirePermission('test_panel.update'), validate(IdParamSchema, 'params'), validate(TestPanelUpsertSchema), asyncHandler(ctrl.updatePanel));
router.delete('/panels/:id', requirePermission('test_panel.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.removePanel));

// ── Test Definitions ──
router.get('/', requirePermission('test_definition.read'), validate(ListTestDefinitionQuerySchema, 'query'), asyncHandler(ctrl.listDefs));
router.get('/:id', requirePermission('test_definition.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getDef));
router.post('/', requirePermission('test_definition.create'), validate(TestDefinitionUpsertSchema), asyncHandler(ctrl.createDef));
router.put('/:id', requirePermission('test_definition.update'), validate(IdParamSchema, 'params'), validate(TestDefinitionUpsertSchema), asyncHandler(ctrl.updateDef));
router.post('/:id/approve', requirePermission('test_definition.approve'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.approveDef));
router.delete('/:id', requirePermission('test_definition.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.removeDef));

export default router;
