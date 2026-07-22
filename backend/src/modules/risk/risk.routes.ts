/**
 * Risk Management (QRM) routes — mounted at /api/risk.
 *
 * Permission split follows the module convention: configuration (frameworks,
 * categories) is QA/admin territory under its own keys, while registers and
 * risks carry the operational CRUD set. See rbac-catalog.ts.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './risk.controller';
import {
  CategoryUpsertSchema,
  FrameworkUpsertSchema,
  HeatmapQuerySchema,
  IdParamSchema,
  LinkUpsertSchema,
  ListCategoryQuerySchema,
  ListFrameworkQuerySchema,
  ListRegisterQuerySchema,
  ListRiskQuerySchema,
  RegisterUpsertSchema,
  RiskCreateSchema,
  RiskUpdateSchema,
  ScoreRiskSchema,
  UpdateRiskStatusSchema,
} from './risk.schema';

const router = Router();

router.use(requireAuth);

// ── Frameworks (configuration) ──────────────────────────────────────────────
router.get('/frameworks', requirePermission('risk_framework.read'), validate(ListFrameworkQuerySchema, 'query'), asyncHandler(ctrl.listFrameworks));
router.get('/frameworks/:id', requirePermission('risk_framework.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getFramework));
router.post('/frameworks', requirePermission('risk_framework.create'), validate(FrameworkUpsertSchema), asyncHandler(ctrl.createFramework));
router.put('/frameworks/:id', requirePermission('risk_framework.update'), validate(IdParamSchema, 'params'), validate(FrameworkUpsertSchema), asyncHandler(ctrl.updateFramework));
router.post('/frameworks/:id/clone', requirePermission('risk_framework.create'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.cloneFramework));
router.delete('/frameworks/:id', requirePermission('risk_framework.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteFramework));

// ── Categories (configuration) ──────────────────────────────────────────────
router.get('/categories', requirePermission('risk_category.read'), validate(ListCategoryQuerySchema, 'query'), asyncHandler(ctrl.listCategories));
router.post('/categories', requirePermission('risk_category.create'), validate(CategoryUpsertSchema), asyncHandler(ctrl.createCategory));
router.put('/categories/:id', requirePermission('risk_category.update'), validate(IdParamSchema, 'params'), validate(CategoryUpsertSchema), asyncHandler(ctrl.updateCategory));
router.delete('/categories/:id', requirePermission('risk_category.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteCategory));

// ── Analytics — declared before /registers/:id so the literal path wins ──────
router.get('/analytics/heatmap', requirePermission('risk.read'), validate(HeatmapQuerySchema, 'query'), asyncHandler(ctrl.getHeatmap));
router.get('/analytics/summary', requirePermission('risk.read'), validate(HeatmapQuerySchema, 'query'), asyncHandler(ctrl.getSummary));

// ── Registers ───────────────────────────────────────────────────────────────
router.get('/registers', requirePermission('risk_register.read'), validate(ListRegisterQuerySchema, 'query'), asyncHandler(ctrl.listRegisters));
router.get('/registers/:id', requirePermission('risk_register.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getRegister));
router.post('/registers', requirePermission('risk_register.create'), validate(RegisterUpsertSchema), asyncHandler(ctrl.createRegister));
router.put('/registers/:id', requirePermission('risk_register.update'), validate(IdParamSchema, 'params'), validate(RegisterUpsertSchema), asyncHandler(ctrl.updateRegister));
router.delete('/registers/:id', requirePermission('risk_register.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteRegister));

// ── Risks ───────────────────────────────────────────────────────────────────
router.get('/risks', requirePermission('risk.read'), validate(ListRiskQuerySchema, 'query'), asyncHandler(ctrl.listRisks));
router.get('/risks/:id', requirePermission('risk.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getRisk));
router.get('/risks/:id/history', requirePermission('risk.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getRiskHistory));
router.post('/risks', requirePermission('risk.create'), validate(RiskCreateSchema), asyncHandler(ctrl.createRisk));
router.put('/risks/:id', requirePermission('risk.update'), validate(IdParamSchema, 'params'), validate(RiskUpdateSchema), asyncHandler(ctrl.updateRisk));
router.post('/risks/:id/score', requirePermission('risk.update'), validate(IdParamSchema, 'params'), validate(ScoreRiskSchema), asyncHandler(ctrl.scoreRisk));
router.patch('/risks/:id/status', requirePermission('risk.update'), validate(IdParamSchema, 'params'), validate(UpdateRiskStatusSchema), asyncHandler(ctrl.updateRiskStatus));
router.delete('/risks/:id', requirePermission('risk.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteRisk));

// ── Links ───────────────────────────────────────────────────────────────────
router.post('/risks/:id/links', requirePermission('risk.update'), validate(IdParamSchema, 'params'), validate(LinkUpsertSchema), asyncHandler(ctrl.addLink));
router.delete('/links/:id', requirePermission('risk.update'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.removeLink));

export default router;
