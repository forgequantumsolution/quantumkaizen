/**
 * Risk Management (QRM) routes — mounted at /api/risk.
 *
 * Permission split follows the module convention: configuration (frameworks,
 * categories) is QA/admin territory under its own keys, while registers and
 * risks carry the operational CRUD set. See rbac-catalog.ts.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAnyPermission, requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './risk.controller';
import {
  CategoryUpsertSchema,
  FrameworkUpsertSchema,
  AppetiteUpsertSchema,
  HeatmapQuerySchema,
  IdParamSchema,
  ListTriggerRuleQuerySchema,
  LinkSearchQuerySchema,
  LinkUpsertSchema,
  ListCategoryQuerySchema,
  ListFrameworkQuerySchema,
  ListRegisterQuerySchema,
  ListRiskQuerySchema,
  ProfileQuerySchema,
  ProfileRankQuerySchema,
  RegisterUpsertSchema,
  ReverseLinkQuerySchema,
  RiskCreateSchema,
  RiskUpdateSchema,
  ScoreRiskSchema,
  TriggerRuleUpsertSchema,
  TriggerSchema,
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

// ── Triggers (raise risk work from another module's record) ─────────────────
// Creating risk work needs risk.create, not merely the source module's write
// key: a finding author must not be able to conjure register entries they could
// not otherwise create.
router.post('/triggers', requirePermission('risk.create'), validate(TriggerSchema), asyncHandler(ctrl.runTrigger));
router.get('/trigger-rules', requirePermission('risk_trigger.read'), validate(ListTriggerRuleQuerySchema, 'query'), asyncHandler(ctrl.listTriggerRules));
router.post('/trigger-rules', requirePermission('risk_trigger.create'), validate(TriggerRuleUpsertSchema), asyncHandler(ctrl.createTriggerRule));
router.put('/trigger-rules/:id', requirePermission('risk_trigger.update'), validate(IdParamSchema, 'params'), validate(TriggerRuleUpsertSchema), asyncHandler(ctrl.updateTriggerRule));
router.delete('/trigger-rules/:id', requirePermission('risk_trigger.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteTriggerRule));

// ── Risk appetite (organisational tolerance) ────────────────────────────────
router.get('/appetite', requirePermission('risk_appetite.read'), asyncHandler(ctrl.listAppetites));
router.post('/appetite', requirePermission('risk_appetite.create'), validate(AppetiteUpsertSchema), asyncHandler(ctrl.createAppetite));
router.put('/appetite/:id', requirePermission('risk_appetite.update'), validate(IdParamSchema, 'params'), validate(AppetiteUpsertSchema), asyncHandler(ctrl.updateAppetite));
router.delete('/appetite/:id', requirePermission('risk_appetite.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteAppetite));

// ── Risk profile (cross-module read model) ──────────────────────────────────
// `risk_profile.read` exists so the grant that lets a supplier page show a risk
// level is separable from the grant that opens the risk register. It is an OR
// with `risk.read` rather than a replacement: anyone already trusted with the
// register implicitly may see a derived chip, and existing roles keep working
// on the day this ships without an admin having to grant a brand-new key first.
router.get('/profile', requireAnyPermission('risk_profile.read', 'risk.read'), validate(ProfileQuerySchema, 'query'), asyncHandler(ctrl.getProfile));
router.get('/profile/ranked', requireAnyPermission('risk_profile.read', 'risk.read'), validate(ProfileRankQuerySchema, 'query'), asyncHandler(ctrl.listByRisk));
// Full rebuild — an admin repair path, not a routine call.
router.post('/profile/recompute', requirePermission('risk_framework.update'), asyncHandler(ctrl.recomputeProfiles));

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
// The literal /links/* GETs are kept above the DELETE /links/:id purely for
// readability — the methods differ, so no shadowing is possible. Add any future
// GET /links/:id *below* these two or it will swallow them.
router.get('/links/types', requirePermission('risk.read'), asyncHandler(ctrl.listLinkableTypes));
router.get('/links/search', requirePermission('risk.read'), validate(LinkSearchQuerySchema, 'query'), asyncHandler(ctrl.searchLinkable));
// Reverse lookup — "which risks point at this record?". Read-gated on risk.read
// because the payload is risks; the picker's per-target filtering lives in
// /links/search, which is the path that can leak other modules' numbers.
router.get('/links', requirePermission('risk.read'), validate(ReverseLinkQuerySchema, 'query'), asyncHandler(ctrl.listRisksLinkedTo));
router.post('/risks/:id/links', requirePermission('risk.update'), validate(IdParamSchema, 'params'), validate(LinkUpsertSchema), asyncHandler(ctrl.addLink));
router.delete('/links/:id', requirePermission('risk.update'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.removeLink));

export default router;
