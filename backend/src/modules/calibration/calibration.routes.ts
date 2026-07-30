/**
 * Calibration routes — mounted at /api/calibration.
 *
 * Every route is gated by a `calibration_*` permission key from the RBAC
 * catalog, so the module's access is configurable independently of every other
 * module. The public label-verify router is exported separately and mounted
 * before the authenticated catch-all.
 */
import { Router } from 'express';
import * as ctrl from './calibration.controller';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  AddStandardSchema,
  AnalyticsQuerySchema,
  ApplyPackSchema,
  CategoryUpsertSchema,
  CreateCheckSchema,
  CreateEventSchema,
  CreateMsaSchema,
  IdParamSchema,
  InstrumentUpsertSchema,
  ListCategoriesQuerySchema,
  ListChecksQuerySchema,
  ListEventsQuerySchema,
  ListInstrumentsQuerySchema,
  ListMsaQuerySchema,
  ListOotQuerySchema,
  ListProvidersQuerySchema,
  NotifyCustomerSchema,
  PlanUpsertSchema,
  ProductHoldSchema,
  ProviderUpsertSchema,
  ReasonSchema,
  ReviewDecisionSchema,
  SaveMsaTrialsSchema,
  SaveReadingsSchema,
  SignatureSchema,
  SpawnFromOotSchema,
  TokenParamSchema,
  UpdateConfigSchema,
  UpdateEventSchema,
  UpdateOotSchema,
} from './calibration.schema';

const router = Router();
router.use(requireAuth);

const P = {
  instrumentRead: requirePermission('calibration_instrument.read'),
  instrumentCreate: requirePermission('calibration_instrument.create'),
  instrumentUpdate: requirePermission('calibration_instrument.update'),
  instrumentDelete: requirePermission('calibration_instrument.delete'),
  instrumentRetire: requirePermission('calibration_instrument.retire'),
  planRead: requirePermission('calibration_plan.read'),
  planCreate: requirePermission('calibration_plan.create'),
  planUpdate: requirePermission('calibration_plan.update'),
  eventRead: requirePermission('calibration_event.read'),
  eventCreate: requirePermission('calibration_event.create'),
  eventUpdate: requirePermission('calibration_event.update'),
  eventDelete: requirePermission('calibration_event.delete'),
  eventPerform: requirePermission('calibration_event.perform'),
  eventReview: requirePermission('calibration_event.review'),
  eventApprove: requirePermission('calibration_event.approve'),
  ootRead: requirePermission('calibration_oot.read'),
  ootUpdate: requirePermission('calibration_oot.update'),
  ootApprove: requirePermission('calibration_oot.approve'),
  ootNotify: requirePermission('calibration_oot.notify'),
  checkRead: requirePermission('calibration_check.read'),
  checkCreate: requirePermission('calibration_check.create'),
  standardRead: requirePermission('calibration_standard.read'),
  providerRead: requirePermission('calibration_provider.read'),
  providerCreate: requirePermission('calibration_provider.create'),
  providerUpdate: requirePermission('calibration_provider.update'),
  providerDelete: requirePermission('calibration_provider.delete'),
  msaRead: requirePermission('msa_study.read'),
  msaCreate: requirePermission('msa_study.create'),
  msaUpdate: requirePermission('msa_study.update'),
  msaApprove: requirePermission('msa_study.approve'),
  configRead: requirePermission('calibration_config.read'),
  configUpdate: requirePermission('calibration_config.update'),
  analytics: requirePermission('calibration_analytics.read'),
};

const idParam = validate(IdParamSchema, 'params');

// ── Configuration & industry packs ──
router.get('/config', P.configRead, asyncHandler(ctrl.getConfig));
router.put('/config', P.configUpdate, validate(UpdateConfigSchema), asyncHandler(ctrl.updateConfig));
router.get('/config/packs', P.configRead, asyncHandler(ctrl.listPacks));
router.post('/config/apply-pack', P.configUpdate, validate(ApplyPackSchema), asyncHandler(ctrl.applyPack));

// ── Categories & point templates ──
router.get('/categories', P.configRead, validate(ListCategoriesQuerySchema, 'query'), asyncHandler(ctrl.listCategories));
router.get('/categories/:id', P.configRead, idParam, asyncHandler(ctrl.getCategory));
router.post('/categories', P.configUpdate, validate(CategoryUpsertSchema), asyncHandler(ctrl.createCategory));
router.put('/categories/:id', P.configUpdate, idParam, validate(CategoryUpsertSchema), asyncHandler(ctrl.updateCategory));
router.delete('/categories/:id', P.configUpdate, idParam, asyncHandler(ctrl.deleteCategory));
router.put('/categories/:id/point-templates', P.configUpdate, idParam, asyncHandler(ctrl.replacePointTemplates));

// ── Instruments ──
// Static segments precede '/:id' so "standards" is never read as an id.
router.get('/instruments/standards', P.standardRead, asyncHandler(ctrl.listStandards));
router.get('/instruments/lims-search', P.instrumentUpdate, asyncHandler(ctrl.searchLimsEquipment));
router.get('/instruments', P.instrumentRead, validate(ListInstrumentsQuerySchema, 'query'), asyncHandler(ctrl.listInstruments));
router.post('/instruments', P.instrumentCreate, validate(InstrumentUpsertSchema), asyncHandler(ctrl.createInstrument));
router.get('/instruments/:id', P.instrumentRead, idParam, asyncHandler(ctrl.getInstrument));
router.put('/instruments/:id', P.instrumentUpdate, idParam, validate(InstrumentUpsertSchema), asyncHandler(ctrl.updateInstrument));
router.delete('/instruments/:id', P.instrumentDelete, idParam, asyncHandler(ctrl.deleteInstrument));
router.post('/instruments/:id/retire', P.instrumentRetire, idParam, validate(ReasonSchema), asyncHandler(ctrl.retireInstrument));
router.post('/instruments/:id/out-of-service', P.instrumentUpdate, idParam, validate(ReasonSchema), asyncHandler(ctrl.outOfService));
router.post('/instruments/:id/return-to-service', P.instrumentUpdate, idParam, validate(ReasonSchema), asyncHandler(ctrl.returnToService));
router.post('/instruments/:id/exempt', P.instrumentRetire, idParam, validate(ReasonSchema), asyncHandler(ctrl.exemptInstrument));
router.get('/instruments/:id/history', P.instrumentRead, idParam, asyncHandler(ctrl.instrumentHistory));
router.get('/instruments/:id/drift', P.instrumentRead, idParam, asyncHandler(ctrl.instrumentDrift));
router.get('/instruments/:id/label', P.instrumentRead, idParam, asyncHandler(ctrl.instrumentLabel));
router.get('/instruments/:id/usable', P.instrumentRead, idParam, asyncHandler(ctrl.instrumentUsable));

// ── Plans (nested under an instrument for create/list) ──
router.get('/instruments/:id/plans', P.planRead, idParam, asyncHandler(ctrl.listPlans));
router.post('/instruments/:id/plans', P.planCreate, idParam, validate(PlanUpsertSchema), asyncHandler(ctrl.createPlan));
router.get('/instruments/:id/plan-suggestion', P.planRead, idParam, asyncHandler(ctrl.suggestPlan));
router.get('/plans/:id', P.planRead, idParam, asyncHandler(ctrl.getPlan));
router.put('/plans/:id', P.planUpdate, idParam, validate(PlanUpsertSchema), asyncHandler(ctrl.supersedePlan));
router.post('/plans/:id/deactivate', P.planUpdate, idParam, validate(ReasonSchema), asyncHandler(ctrl.deactivatePlan));

// ── In-use verification checks ──
router.get('/checks/due', P.checkRead, asyncHandler(ctrl.listDueChecks));
router.get('/checks', P.checkRead, validate(ListChecksQuerySchema, 'query'), asyncHandler(ctrl.listChecks));
router.post('/instruments/:id/checks', P.checkCreate, idParam, validate(CreateCheckSchema), asyncHandler(ctrl.createCheck));

// ── Calibration events ──
router.get('/events', P.eventRead, validate(ListEventsQuerySchema, 'query'), asyncHandler(ctrl.listEvents));
router.post('/events', P.eventCreate, validate(CreateEventSchema), asyncHandler(ctrl.createEvent));
router.get('/events/:id', P.eventRead, idParam, asyncHandler(ctrl.getEvent));
router.put('/events/:id', P.eventUpdate, idParam, validate(UpdateEventSchema), asyncHandler(ctrl.updateEvent));
router.post('/events/:id/start', P.eventPerform, idParam, asyncHandler(ctrl.startEvent));
router.put('/events/:id/readings', P.eventPerform, idParam, validate(SaveReadingsSchema), asyncHandler(ctrl.saveReadings));
router.post('/events/:id/standards', P.eventPerform, idParam, validate(AddStandardSchema), asyncHandler(ctrl.addStandard));
router.delete('/events/:id/standards/:useId', P.eventPerform, idParam, asyncHandler(ctrl.removeStandard));
router.post('/events/:id/submit', P.eventPerform, idParam, validate(SignatureSchema), asyncHandler(ctrl.submitEvent));
router.post('/events/:id/review', P.eventReview, idParam, validate(ReviewDecisionSchema), asyncHandler(ctrl.reviewEvent));
router.post('/events/:id/approve', P.eventApprove, idParam, validate(SignatureSchema), asyncHandler(ctrl.approveEvent));
router.post('/events/:id/reject', P.eventReview, idParam, validate(ReasonSchema), asyncHandler(ctrl.rejectEvent));
router.post('/events/:id/cancel', P.eventDelete, idParam, validate(ReasonSchema), asyncHandler(ctrl.cancelEvent));
router.post('/events/:id/raise-oot', P.ootUpdate, idParam, asyncHandler(ctrl.raiseOot));
router.get('/events/:id/certificate', P.eventRead, idParam, asyncHandler(ctrl.getCertificate));

// ── Out-of-tolerance assessments ──
router.get('/oot', P.ootRead, validate(ListOotQuerySchema, 'query'), asyncHandler(ctrl.listOot));
router.get('/oot/:id', P.ootRead, idParam, asyncHandler(ctrl.getOot));
router.post('/oot/:id/scan-impact', P.ootUpdate, idParam, asyncHandler(ctrl.scanOotImpact));
router.put('/oot/:id', P.ootUpdate, idParam, validate(UpdateOotSchema), asyncHandler(ctrl.updateOot));
router.post('/oot/:id/submit', P.ootUpdate, idParam, asyncHandler(ctrl.submitOot));
router.post('/oot/:id/approve', P.ootApprove, idParam, validate(SignatureSchema), asyncHandler(ctrl.approveOot));
router.post('/oot/:id/spawn', P.ootUpdate, idParam, validate(SpawnFromOotSchema), asyncHandler(ctrl.spawnFromOot));
router.post('/oot/:id/notify-customer', P.ootNotify, idParam, validate(NotifyCustomerSchema), asyncHandler(ctrl.notifyCustomer));
router.post('/oot/:id/product-hold', P.ootNotify, idParam, validate(ProductHoldSchema), asyncHandler(ctrl.productHold));

// ── MSA / Gage R&R (Automotive pack) ──
router.get('/msa', P.msaRead, validate(ListMsaQuerySchema, 'query'), asyncHandler(ctrl.listMsa));
router.post('/msa', P.msaCreate, validate(CreateMsaSchema), asyncHandler(ctrl.createMsa));
router.get('/msa/:id', P.msaRead, idParam, asyncHandler(ctrl.getMsa));
router.put('/msa/:id/trials', P.msaUpdate, idParam, validate(SaveMsaTrialsSchema), asyncHandler(ctrl.saveMsaTrials));
router.post('/msa/:id/compute', P.msaUpdate, idParam, asyncHandler(ctrl.computeMsa));
router.post('/msa/:id/approve', P.msaApprove, idParam, asyncHandler(ctrl.approveMsa));
router.delete('/msa/:id', P.msaUpdate, idParam, asyncHandler(ctrl.deleteMsa));

// ── Providers ──
router.get('/providers/expiring', P.providerRead, asyncHandler(ctrl.expiringAccreditations));
router.get('/providers', P.providerRead, validate(ListProvidersQuerySchema, 'query'), asyncHandler(ctrl.listProviders));
router.post('/providers', P.providerCreate, validate(ProviderUpsertSchema), asyncHandler(ctrl.createProvider));
router.get('/providers/:id', P.providerRead, idParam, asyncHandler(ctrl.getProvider));
router.put('/providers/:id', P.providerUpdate, idParam, validate(ProviderUpsertSchema), asyncHandler(ctrl.updateProvider));
router.delete('/providers/:id', P.providerDelete, idParam, asyncHandler(ctrl.deleteProvider));

// ── Analytics ──
router.get('/analytics/overview', P.analytics, validate(AnalyticsQuerySchema, 'query'), asyncHandler(ctrl.overview));
router.get('/analytics/summary', P.analytics, validate(AnalyticsQuerySchema, 'query'), asyncHandler(ctrl.summary));
router.get('/analytics/schedule', P.analytics, validate(AnalyticsQuerySchema, 'query'), asyncHandler(ctrl.schedule));
router.get('/analytics/by-category', P.analytics, validate(AnalyticsQuerySchema, 'query'), asyncHandler(ctrl.byCategory));
router.get('/analytics/providers', P.analytics, validate(AnalyticsQuerySchema, 'query'), asyncHandler(ctrl.providerPerformance));
router.get('/analytics/oot-trend', P.analytics, validate(AnalyticsQuerySchema, 'query'), asyncHandler(ctrl.ootTrend));
router.get('/analytics/capabilities', P.analytics, asyncHandler(ctrl.capabilities));

export default router;

/**
 * Public label scan — no auth, mirroring the CoA QR-verify precedent. Exposes
 * calibration status only; a sticker is not an access grant.
 */
export const calibrationPublicRouter = Router();
calibrationPublicRouter.get(
  '/verify/:token',
  validate(TokenParamSchema, 'params'),
  asyncHandler(ctrl.verifyLabel),
);
