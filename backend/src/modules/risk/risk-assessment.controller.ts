/**
 * Risk assessment controllers — thin by convention: no try/catch (asyncHandler
 * plus the central error handler own that), no business logic, responses via the
 * shared ok()/success() envelope helpers.
 */
import type { Request, Response } from 'express';
import { ok, success } from '../dynamic-form/dynamic-form.response';
import * as svc from './risk-assessment.service';
import type { LinkUpsert } from './risk.schema';
import type {
  ApproveAssessment,
  AssessmentCreate,
  AssessmentUpdate,
  BulkLines,
  LineUpsert,
  ListAssessmentQuery,
  ListLineQuery,
  PromoteLine,
  RejectAssessment,
  ReviseAssessment,
  UpdateAssessmentStatus,
} from './risk-assessment.schema';

const actor = (req: Request) => req.user?.userId;

// ── Assessments ─────────────────────────────────────────────────────────────

export const listAssessments = async (req: Request, res: Response) =>
  ok(res, await svc.listAssessments(req.query as unknown as ListAssessmentQuery));

export const getAssessment = async (req: Request, res: Response) =>
  ok(res, await svc.getAssessment(req.params.id as string));

export const createAssessment = async (req: Request, res: Response) =>
  success(res, 'Risk assessment created', await svc.createAssessment(req.body as AssessmentCreate, actor(req)), 201);

export const updateAssessment = async (req: Request, res: Response) =>
  success(res, 'Risk assessment updated', await svc.updateAssessment(req.params.id as string, req.body as AssessmentUpdate, actor(req)));

export const deleteAssessment = async (req: Request, res: Response) => {
  await svc.deleteAssessment(req.params.id as string, actor(req));
  return success(res, 'Risk assessment deleted');
};

export const updateAssessmentStatus = async (req: Request, res: Response) =>
  success(res, 'Assessment status updated', await svc.updateAssessmentStatus(req.params.id as string, req.body as UpdateAssessmentStatus, actor(req)));

export const approveAssessment = async (req: Request, res: Response) =>
  success(res, 'Risk assessment approved', await svc.approveAssessment(req.params.id as string, req.body as ApproveAssessment, actor(req)));

export const rejectAssessment = async (req: Request, res: Response) =>
  success(res, 'Risk assessment rejected', await svc.rejectAssessment(req.params.id as string, req.body as RejectAssessment, actor(req)));

export const reviseAssessment = async (req: Request, res: Response) =>
  success(res, 'Risk assessment revised', await svc.reviseAssessment(req.params.id as string, req.body as ReviseAssessment, actor(req)), 201);

// ── Worksheet lines ─────────────────────────────────────────────────────────

export const listLines = async (req: Request, res: Response) =>
  ok(res, await svc.listLines(req.params.id as string, req.query as unknown as ListLineQuery));

export const createLine = async (req: Request, res: Response) =>
  success(res, 'Worksheet line added', await svc.createLine(req.params.id as string, req.body as LineUpsert, actor(req)), 201);

export const saveLinesBulk = async (req: Request, res: Response) =>
  success(res, 'Worksheet saved', await svc.saveLinesBulk(req.params.id as string, req.body as BulkLines, actor(req)));

export const updateLine = async (req: Request, res: Response) =>
  success(res, 'Worksheet line updated', await svc.updateLine(req.params.id as string, req.body as LineUpsert, actor(req)));

export const deleteLine = async (req: Request, res: Response) => {
  await svc.deleteLine(req.params.id as string, actor(req));
  return success(res, 'Worksheet line deleted');
};

export const promoteLine = async (req: Request, res: Response) =>
  success(res, 'Worksheet line promoted to a tracked risk', await svc.promoteLine(req.params.id as string, req.body as PromoteLine, actor(req)), 201);

export const addAssessmentLink = async (req: Request, res: Response) =>
  success(res, 'Link added', await svc.addAssessmentLink(req.params.id as string, req.body as LinkUpsert, actor(req)), 201);

export const listAssessmentsLinkedTo = async (req: Request, res: Response) => {
  const q = req.query as unknown as { entityType: string; entityId: string };
  return ok(res, await svc.listAssessmentsLinkedTo(q.entityType, q.entityId));
};
