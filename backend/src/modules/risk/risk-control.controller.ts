/**
 * Risk Management phase 3/4 controllers — risk controls, periodic reviews,
 * residual-risk acceptance and the hazard / control libraries.
 *
 * Thin by convention: no try/catch (asyncHandler plus the central error handler
 * own that), no business logic, responses via the shared ok()/success() helpers.
 */
import type { Request, Response } from 'express';
import { ok, success } from '../dynamic-form/dynamic-form.response';
import * as controls from './risk-control.service';
import * as reviews from './risk-review.service';
import * as library from './risk-library.service';
import type {
  AcceptRisk,
  CompleteReview,
  DecideRiskApproval,
  RequestRiskApproval,
  ControlCreate,
  ControlLibraryUpsert,
  ControlStatusUpdate,
  ControlUpdate,
  HazardLibraryUpsert,
  ListControlLibraryQuery,
  ListControlQuery,
  ListHazardLibraryQuery,
  ListReviewQuery,
  ReviewCreate,
  VerifyControl,
} from './risk-control.schema';

const actor = (req: Request) => req.user?.userId;

// ── Controls ────────────────────────────────────────────────────────────────

export const listControls = async (req: Request, res: Response) =>
  ok(res, await controls.listControls(req.query as unknown as ListControlQuery));

export const getControl = async (req: Request, res: Response) =>
  ok(res, await controls.getControl(req.params.id as string));

export const listControlsForRisk = async (req: Request, res: Response) =>
  ok(res, await controls.listControlsForRisk(req.params.id as string));

export const createControl = async (req: Request, res: Response) =>
  success(
    res,
    'Risk control created',
    await controls.createControl(req.params.id as string, req.body as ControlCreate, actor(req)),
    201,
  );

export const updateControl = async (req: Request, res: Response) =>
  success(
    res,
    'Risk control updated',
    await controls.updateControl(req.params.id as string, req.body as ControlUpdate, actor(req)),
  );

export const updateControlStatus = async (req: Request, res: Response) =>
  success(
    res,
    'Risk control status updated',
    await controls.updateControlStatus(
      req.params.id as string,
      req.body as ControlStatusUpdate,
      actor(req),
    ),
  );

export const verifyControl = async (req: Request, res: Response) =>
  success(
    res,
    'Control effectiveness recorded',
    await controls.verifyControl(req.params.id as string, req.body as VerifyControl, actor(req)),
  );

export const deleteControl = async (req: Request, res: Response) => {
  await controls.deleteControl(req.params.id as string, actor(req));
  return success(res, 'Risk control deleted');
};

// ── Residual-risk acceptance ────────────────────────────────────────────────

export const acceptRisk = async (req: Request, res: Response) =>
  success(
    res,
    'Residual risk accepted',
    await controls.acceptRisk(req.params.id as string, req.body as AcceptRisk, actor(req)),
    201,
  );

export const listAcceptances = async (req: Request, res: Response) =>
  ok(res, await controls.listAcceptances(req.params.id as string));

// ── Periodic reviews ────────────────────────────────────────────────────────

export const listReviews = async (req: Request, res: Response) =>
  ok(res, await reviews.listReviews(req.query as unknown as ListReviewQuery));

export const getReview = async (req: Request, res: Response) =>
  ok(res, await reviews.getReview(req.params.id as string));

export const listReviewsForRisk = async (req: Request, res: Response) =>
  ok(res, await reviews.listReviewsForRisk(req.params.id as string));

export const createReview = async (req: Request, res: Response) =>
  success(
    res,
    'Risk review scheduled',
    await reviews.createReview(req.params.id as string, req.body as ReviewCreate, actor(req)),
    201,
  );

export const updateReview = async (req: Request, res: Response) =>
  success(
    res,
    'Risk review rescheduled',
    await reviews.updateReview(req.params.id as string, req.body as ReviewCreate, actor(req)),
  );

export const completeReview = async (req: Request, res: Response) =>
  success(
    res,
    'Risk review completed',
    await reviews.completeReview(req.params.id as string, req.body as CompleteReview, actor(req)),
  );

// ── Hazard library ──────────────────────────────────────────────────────────

export const listHazardLibrary = async (req: Request, res: Response) =>
  ok(res, await library.listHazardLibrary(req.query as unknown as ListHazardLibraryQuery));

export const createHazardLibraryItem = async (req: Request, res: Response) =>
  success(
    res,
    'Hazard library item created',
    await library.createHazardLibraryItem(req.body as HazardLibraryUpsert, actor(req)),
    201,
  );

export const updateHazardLibraryItem = async (req: Request, res: Response) =>
  success(
    res,
    'Hazard library item updated',
    await library.updateHazardLibraryItem(
      req.params.id as string,
      req.body as HazardLibraryUpsert,
      actor(req),
    ),
  );

export const deleteHazardLibraryItem = async (req: Request, res: Response) => {
  await library.deleteHazardLibraryItem(req.params.id as string, actor(req));
  return success(res, 'Hazard library item deleted');
};

// ── Control library ─────────────────────────────────────────────────────────

export const listControlLibrary = async (req: Request, res: Response) =>
  ok(res, await library.listControlLibrary(req.query as unknown as ListControlLibraryQuery));

export const createControlLibraryItem = async (req: Request, res: Response) =>
  success(
    res,
    'Control library item created',
    await library.createControlLibraryItem(req.body as ControlLibraryUpsert, actor(req)),
    201,
  );

export const updateControlLibraryItem = async (req: Request, res: Response) =>
  success(
    res,
    'Control library item updated',
    await library.updateControlLibraryItem(
      req.params.id as string,
      req.body as ControlLibraryUpsert,
      actor(req),
    ),
  );

export const deleteControlLibraryItem = async (req: Request, res: Response) => {
  await library.deleteControlLibraryItem(req.params.id as string, actor(req));
  return success(res, 'Control library item deleted');
};

// ── Second-person approval ──────────────────────────────────────────────────

export const listApprovals = async (req: Request, res: Response) =>
  ok(res, await controls.listApprovals(req.params.id as string));

export const requestApproval = async (req: Request, res: Response) =>
  success(res, 'Approval requested', await controls.requestApproval(req.params.id as string, req.body as RequestRiskApproval, actor(req)), 201);

export const decideApproval = async (req: Request, res: Response) =>
  success(res, 'Approval decision recorded', await controls.decideApproval(req.params.id as string, req.body as DecideRiskApproval, actor(req)));
