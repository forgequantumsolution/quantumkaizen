/**
 * Calibration controllers — thin HTTP adapters. All logic lives in the services.
 */
import type { Request, Response } from 'express';
import * as config from './config.service';
import * as instrument from './instrument.service';
import * as plan from './plan.service';
import * as event from './event.service';
import * as oot from './oot.service';
import * as check from './check.service';
import * as msa from './msa.service';
import * as provider from './provider.service';
import * as analytics from './analytics.service';
import type {
  AddStandardInput,
  ApplyPackInput,
  AnalyticsQuery,
  CategoryUpsertInput,
  CreateCheckInput,
  CreateEventInput,
  CreateMsaInput,
  InstrumentUpsertInput,
  ListCategoriesQuery,
  ListChecksQuery,
  ListEventsQuery,
  ListInstrumentsQuery,
  ListMsaQuery,
  ListOotQuery,
  ListProvidersQuery,
  NotifyCustomerInput,
  PlanUpsertInput,
  ProductHoldInput,
  ProviderUpsertInput,
  ReasonInput,
  ReviewDecisionInput,
  SaveMsaTrialsInput,
  SaveReadingsInput,
  SignatureInput,
  SpawnFromOotInput,
  UpdateConfigInput,
  UpdateEventInput,
  UpdateOotInput,
} from './calibration.schema';

const uid = (req: Request) => req.user?.userId;
const id = (req: Request) => req.params.id as string;
const q = <T>(req: Request) => req.query as unknown as T;
const body = <T>(req: Request) => req.body as T;

// ── Config & packs ──
export const getConfig = async (req: Request, res: Response) => {
  res.json(await config.getConfig((req.query.site_id as string) ?? null));
};
export const updateConfig = async (req: Request, res: Response) => {
  res.json(await config.updateConfig(body<UpdateConfigInput>(req), uid(req)));
};
export const listPacks = async (_req: Request, res: Response) => {
  res.json(await config.listPacks());
};
export const applyPack = async (req: Request, res: Response) => {
  res.json(await config.applyPack(body<ApplyPackInput>(req), uid(req)));
};

// ── Categories ──
export const listCategories = async (req: Request, res: Response) => {
  res.json(await config.listCategories(q<ListCategoriesQuery>(req)));
};
export const getCategory = async (req: Request, res: Response) => {
  res.json(await config.getCategory(id(req)));
};
export const createCategory = async (req: Request, res: Response) => {
  res.status(201).json(await config.createCategory(body<CategoryUpsertInput>(req), uid(req)));
};
export const updateCategory = async (req: Request, res: Response) => {
  res.json(await config.updateCategory(id(req), body<CategoryUpsertInput>(req), uid(req)));
};
export const deleteCategory = async (req: Request, res: Response) => {
  await config.deleteCategory(id(req), uid(req));
  res.status(204).send();
};
export const replacePointTemplates = async (req: Request, res: Response) => {
  const { points } = req.body as { points: Parameters<typeof config.replacePointTemplates>[1] };
  res.json(await config.replacePointTemplates(id(req), points, uid(req)));
};

// ── Instruments ──
export const listInstruments = async (req: Request, res: Response) => {
  res.json(await instrument.listInstruments(q<ListInstrumentsQuery>(req)));
};
export const getInstrument = async (req: Request, res: Response) => {
  res.json(await instrument.getInstrument(id(req)));
};
export const createInstrument = async (req: Request, res: Response) => {
  res.status(201).json(await instrument.createInstrument(body<InstrumentUpsertInput>(req), uid(req)));
};
export const updateInstrument = async (req: Request, res: Response) => {
  res.json(await instrument.updateInstrument(id(req), body<InstrumentUpsertInput>(req), uid(req)));
};
export const deleteInstrument = async (req: Request, res: Response) => {
  await instrument.deleteInstrument(id(req), uid(req));
  res.status(204).send();
};
export const retireInstrument = async (req: Request, res: Response) => {
  res.json(await instrument.retireInstrument(id(req), body<ReasonInput>(req), uid(req)));
};
export const outOfService = async (req: Request, res: Response) => {
  res.json(await instrument.setOutOfService(id(req), body<ReasonInput>(req), uid(req)));
};
export const returnToService = async (req: Request, res: Response) => {
  res.json(await instrument.returnToService(id(req), body<ReasonInput>(req), uid(req)));
};
export const exemptInstrument = async (req: Request, res: Response) => {
  res.json(await instrument.exemptInstrument(id(req), body<ReasonInput>(req), uid(req)));
};
export const instrumentHistory = async (req: Request, res: Response) => {
  res.json(await instrument.getHistory(id(req)));
};
export const instrumentDrift = async (req: Request, res: Response) => {
  res.json(await instrument.getDrift(id(req)));
};
export const instrumentLabel = async (req: Request, res: Response) => {
  res.json(await instrument.getLabel(id(req)));
};
export const instrumentUsable = async (req: Request, res: Response) => {
  res.json(await instrument.checkUsable(id(req)));
};
export const listStandards = async (req: Request, res: Response) => {
  const days = req.query.days !== undefined ? Number(req.query.days) : undefined;
  res.json(await instrument.listStandards(Number.isFinite(days) ? days : undefined));
};
export const searchLimsEquipment = async (req: Request, res: Response) => {
  res.json(await instrument.searchLinkableLimsEquipment((req.query.q as string) ?? ''));
};
export const verifyLabel = async (req: Request, res: Response) => {
  res.json(await instrument.verifyByToken(req.params.token as string));
};

// ── Plans ──
export const listPlans = async (req: Request, res: Response) => {
  res.json(await plan.listPlans(id(req)));
};
export const getPlan = async (req: Request, res: Response) => {
  res.json(await plan.getPlan(id(req)));
};
export const createPlan = async (req: Request, res: Response) => {
  res.status(201).json(await plan.createPlan(id(req), body<PlanUpsertInput>(req), uid(req)));
};
export const supersedePlan = async (req: Request, res: Response) => {
  res.json(await plan.supersedePlan(id(req), body<PlanUpsertInput>(req), uid(req)));
};
export const deactivatePlan = async (req: Request, res: Response) => {
  res.json(await plan.deactivatePlan(id(req), (req.body as ReasonInput).reason, uid(req)));
};
export const suggestPlan = async (req: Request, res: Response) => {
  res.json(await plan.suggestPlanFromCategory(id(req)));
};

// ── Events ──
export const listEvents = async (req: Request, res: Response) => {
  res.json(await event.listEvents(q<ListEventsQuery>(req)));
};
export const getEvent = async (req: Request, res: Response) => {
  res.json(await event.getEvent(id(req)));
};
export const createEvent = async (req: Request, res: Response) => {
  res.status(201).json(await event.createEvent(body<CreateEventInput>(req), uid(req)));
};
export const updateEvent = async (req: Request, res: Response) => {
  res.json(await event.updateEvent(id(req), body<UpdateEventInput>(req), uid(req)));
};
export const startEvent = async (req: Request, res: Response) => {
  res.json(await event.startEvent(id(req), uid(req)));
};
export const saveReadings = async (req: Request, res: Response) => {
  res.json(await event.saveReadings(id(req), body<SaveReadingsInput>(req), uid(req)));
};
export const addStandard = async (req: Request, res: Response) => {
  res.json(await event.addStandard(id(req), body<AddStandardInput>(req), uid(req)));
};
export const removeStandard = async (req: Request, res: Response) => {
  res.json(await event.removeStandard(id(req), req.params.useId as string, uid(req)));
};
export const submitEvent = async (req: Request, res: Response) => {
  res.json(await event.submitEvent(id(req), body<SignatureInput>(req), uid(req)));
};
export const reviewEvent = async (req: Request, res: Response) => {
  res.json(await event.reviewEvent(id(req), body<ReviewDecisionInput>(req), uid(req)));
};
export const approveEvent = async (req: Request, res: Response) => {
  res.json(await event.approveEvent(id(req), body<SignatureInput>(req), uid(req)));
};
export const rejectEvent = async (req: Request, res: Response) => {
  res.json(await event.rejectEvent(id(req), (req.body as ReasonInput).reason, uid(req)));
};
export const cancelEvent = async (req: Request, res: Response) => {
  res.json(await event.cancelEvent(id(req), (req.body as ReasonInput).reason, uid(req)));
};
export const raiseOot = async (req: Request, res: Response) => {
  res.status(201).json(await event.raiseOot(id(req), uid(req)));
};
export const getCertificate = async (req: Request, res: Response) => {
  res.json(await event.getCertificate(id(req)));
};

// ── Out of tolerance ──
export const listOot = async (req: Request, res: Response) => {
  res.json(await oot.listOot(q<ListOotQuery>(req)));
};
export const getOot = async (req: Request, res: Response) => {
  res.json(await oot.getOot(id(req)));
};
export const scanOotImpact = async (req: Request, res: Response) => {
  res.json(await oot.scanImpact(id(req), uid(req)));
};
export const updateOot = async (req: Request, res: Response) => {
  res.json(await oot.updateOot(id(req), body<UpdateOotInput>(req), uid(req)));
};
export const submitOot = async (req: Request, res: Response) => {
  res.json(await oot.submitOotForApproval(id(req), uid(req)));
};
export const approveOot = async (req: Request, res: Response) => {
  res.json(await oot.approveOot(id(req), (req.body as SignatureInput).comments, uid(req)));
};
export const spawnFromOot = async (req: Request, res: Response) => {
  res.status(201).json(await oot.spawnFromOot(id(req), body<SpawnFromOotInput>(req), uid(req)));
};
export const notifyCustomer = async (req: Request, res: Response) => {
  res.json(await oot.notifyCustomer(id(req), body<NotifyCustomerInput>(req), uid(req)));
};
export const productHold = async (req: Request, res: Response) => {
  res.json(await oot.recordProductHold(id(req), body<ProductHoldInput>(req), uid(req)));
};

// ── In-use checks ──
export const listChecks = async (req: Request, res: Response) => {
  res.json(await check.listChecks(q<ListChecksQuery>(req)));
};
export const createCheck = async (req: Request, res: Response) => {
  res.status(201).json(await check.createCheck(id(req), body<CreateCheckInput>(req), uid(req)));
};
export const listDueChecks = async (req: Request, res: Response) => {
  res.json(await check.listDueChecks(req.query.site_id as string | undefined));
};

// ── MSA ──
export const listMsa = async (req: Request, res: Response) => {
  res.json(await msa.listStudies(q<ListMsaQuery>(req)));
};
export const getMsa = async (req: Request, res: Response) => {
  res.json(await msa.getStudy(id(req)));
};
export const createMsa = async (req: Request, res: Response) => {
  res.status(201).json(await msa.createStudy(body<CreateMsaInput>(req), uid(req)));
};
export const saveMsaTrials = async (req: Request, res: Response) => {
  res.json(await msa.saveTrials(id(req), body<SaveMsaTrialsInput>(req), uid(req)));
};
export const computeMsa = async (req: Request, res: Response) => {
  res.json(await msa.computeStudy(id(req), uid(req)));
};
export const approveMsa = async (req: Request, res: Response) => {
  res.json(await msa.approveStudy(id(req), uid(req)));
};
export const deleteMsa = async (req: Request, res: Response) => {
  await msa.deleteStudy(id(req), uid(req));
  res.status(204).send();
};

// ── Providers ──
export const listProviders = async (req: Request, res: Response) => {
  res.json(await provider.listProviders(q<ListProvidersQuery>(req)));
};
export const getProvider = async (req: Request, res: Response) => {
  res.json(await provider.getProvider(id(req)));
};
export const createProvider = async (req: Request, res: Response) => {
  res.status(201).json(await provider.createProvider(body<ProviderUpsertInput>(req), uid(req)));
};
export const updateProvider = async (req: Request, res: Response) => {
  res.json(await provider.updateProvider(id(req), body<ProviderUpsertInput>(req), uid(req)));
};
export const deleteProvider = async (req: Request, res: Response) => {
  await provider.deleteProvider(id(req), uid(req));
  res.status(204).send();
};
export const expiringAccreditations = async (req: Request, res: Response) => {
  const days = req.query.days !== undefined ? Number(req.query.days) : 60;
  res.json(await provider.listExpiringAccreditations(Number.isFinite(days) ? days : 60));
};

// ── Analytics ──
export const summary = async (req: Request, res: Response) => {
  res.json(await analytics.getSummary(q<AnalyticsQuery>(req)));
};
export const schedule = async (req: Request, res: Response) => {
  res.json(await analytics.getSchedule(q<AnalyticsQuery>(req)));
};
export const byCategory = async (req: Request, res: Response) => {
  res.json(await analytics.getByCategory(q<AnalyticsQuery>(req)));
};
export const providerPerformance = async (req: Request, res: Response) => {
  res.json(await analytics.getProviderPerformance(q<AnalyticsQuery>(req)));
};
export const ootTrend = async (req: Request, res: Response) => {
  res.json(await analytics.getOotTrend(q<AnalyticsQuery>(req)));
};
export const overview = async (req: Request, res: Response) => {
  res.json(await analytics.getOverview(q<AnalyticsQuery>(req)));
};
export const capabilities = async (req: Request, res: Response) => {
  res.json(await analytics.getCapabilities((req.query.site_id as string) ?? null));
};
