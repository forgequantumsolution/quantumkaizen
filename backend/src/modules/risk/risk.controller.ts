/**
 * Risk Management controllers — thin by convention: no try/catch (asyncHandler
 * plus the central error handler own that), no business logic, responses via the
 * shared ok()/success() envelope helpers.
 */
import type { Request, Response } from 'express';
import { ok, success } from '../dynamic-form/dynamic-form.response';
import * as svc from './risk.service';
import * as cfg from './risk-framework.service';
import type {
  CategoryUpsert,
  FrameworkUpsert,
  HeatmapQuery,
  LinkUpsert,
  ListCategoryQuery,
  ListFrameworkQuery,
  ListRegisterQuery,
  ListRiskQuery,
  RegisterUpsert,
  RiskCreate,
  RiskUpdate,
  ScoreRisk,
  UpdateRiskStatus,
} from './risk.schema';

const actor = (req: Request) => req.user?.userId;

// ── Frameworks ──────────────────────────────────────────────────────────────

export const listFrameworks = async (req: Request, res: Response) =>
  ok(res, await cfg.listFrameworks(req.query as unknown as ListFrameworkQuery));

export const getFramework = async (req: Request, res: Response) =>
  ok(res, await cfg.getFramework(req.params.id as string));

export const createFramework = async (req: Request, res: Response) =>
  success(res, 'Risk framework created', await cfg.createFramework(req.body as FrameworkUpsert, actor(req)), 201);

export const updateFramework = async (req: Request, res: Response) =>
  success(res, 'Risk framework updated', await cfg.updateFramework(req.params.id as string, req.body as FrameworkUpsert, actor(req)));

export const cloneFramework = async (req: Request, res: Response) =>
  success(res, 'Risk framework cloned', await cfg.cloneFramework(req.params.id as string, actor(req)), 201);

export const deleteFramework = async (req: Request, res: Response) => {
  await cfg.deleteFramework(req.params.id as string, actor(req));
  return success(res, 'Risk framework deleted');
};

// ── Categories ──────────────────────────────────────────────────────────────

export const listCategories = async (req: Request, res: Response) =>
  ok(res, await cfg.listCategories(req.query as unknown as ListCategoryQuery));

export const createCategory = async (req: Request, res: Response) =>
  success(res, 'Risk category created', await cfg.createCategory(req.body as CategoryUpsert, actor(req)), 201);

export const updateCategory = async (req: Request, res: Response) =>
  success(res, 'Risk category updated', await cfg.updateCategory(req.params.id as string, req.body as CategoryUpsert, actor(req)));

export const deleteCategory = async (req: Request, res: Response) => {
  await cfg.deleteCategory(req.params.id as string, actor(req));
  return success(res, 'Risk category deleted');
};

// ── Registers ───────────────────────────────────────────────────────────────

export const listRegisters = async (req: Request, res: Response) =>
  ok(res, await svc.listRegisters(req.query as unknown as ListRegisterQuery));

export const getRegister = async (req: Request, res: Response) =>
  ok(res, await svc.getRegister(req.params.id as string));

export const createRegister = async (req: Request, res: Response) =>
  success(res, 'Risk register created', await svc.createRegister(req.body as RegisterUpsert, actor(req)), 201);

export const updateRegister = async (req: Request, res: Response) =>
  success(res, 'Risk register updated', await svc.updateRegister(req.params.id as string, req.body as RegisterUpsert, actor(req)));

export const deleteRegister = async (req: Request, res: Response) => {
  await svc.deleteRegister(req.params.id as string, actor(req));
  return success(res, 'Risk register deleted');
};

// ── Risks ───────────────────────────────────────────────────────────────────

export const listRisks = async (req: Request, res: Response) =>
  ok(res, await svc.listRisks(req.query as unknown as ListRiskQuery));

export const getRisk = async (req: Request, res: Response) => ok(res, await svc.getRisk(req.params.id as string));

export const createRisk = async (req: Request, res: Response) =>
  success(res, 'Risk created', await svc.createRisk(req.body as RiskCreate, actor(req)), 201);

export const updateRisk = async (req: Request, res: Response) =>
  success(res, 'Risk updated', await svc.updateRisk(req.params.id as string, req.body as RiskUpdate, actor(req)));

export const scoreRisk = async (req: Request, res: Response) =>
  success(res, 'Risk scored', await svc.scoreRisk(req.params.id as string, req.body as ScoreRisk, actor(req)));

export const updateRiskStatus = async (req: Request, res: Response) =>
  success(res, 'Risk status updated', await svc.updateRiskStatus(req.params.id as string, req.body as UpdateRiskStatus, actor(req)));

export const deleteRisk = async (req: Request, res: Response) => {
  await svc.deleteRisk(req.params.id as string, actor(req));
  return success(res, 'Risk deleted');
};

export const getRiskHistory = async (req: Request, res: Response) =>
  ok(res, await svc.getRiskHistory(req.params.id as string));

export const addLink = async (req: Request, res: Response) =>
  success(res, 'Link added', await svc.addLink(req.params.id as string, req.body as LinkUpsert, actor(req)), 201);

export const removeLink = async (req: Request, res: Response) => {
  await svc.removeLink(req.params.id as string, actor(req));
  return success(res, 'Link removed');
};

// ── Analytics ───────────────────────────────────────────────────────────────

export const getHeatmap = async (req: Request, res: Response) =>
  ok(res, await svc.getHeatmap(req.query as unknown as HeatmapQuery));

export const getSummary = async (req: Request, res: Response) =>
  ok(res, await svc.getSummary(req.query as unknown as HeatmapQuery));
