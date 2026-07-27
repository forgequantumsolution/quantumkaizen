/**
 * Risk Management phase 3/4 routes — controls, periodic reviews, residual-risk
 * acceptance and the hazard / control libraries. Mounted under /api/risk, so
 * every path here is relative to that prefix.
 *
 * Permission split follows the module convention: controls, reviews and the
 * libraries each carry their own CRUD key set, while formal acceptance of
 * residual risk sits behind the dedicated `risk.accept` approval key.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './risk-control.controller';
import {
  AcceptRiskSchema,
  DecideRiskApprovalSchema,
  RequestRiskApprovalSchema,
  CompleteReviewSchema,
  ControlCreateSchema,
  ControlIdParamSchema,
  ControlLibraryUpsertSchema,
  ControlStatusSchema,
  ControlUpdateSchema,
  HazardLibraryUpsertSchema,
  ListControlLibraryQuerySchema,
  ListControlQuerySchema,
  ListHazardLibraryQuerySchema,
  ListReviewQuerySchema,
  ReviewCreateSchema,
  VerifyControlSchema,
} from './risk-control.schema';

const router = Router();

router.use(requireAuth);

// ── Libraries — literal paths, declared before any /:id sibling ─────────────
router.get('/hazard-library', requirePermission('risk_library.read'), validate(ListHazardLibraryQuerySchema, 'query'), asyncHandler(ctrl.listHazardLibrary));
router.post('/hazard-library', requirePermission('risk_library.create'), validate(HazardLibraryUpsertSchema), asyncHandler(ctrl.createHazardLibraryItem));
router.put('/hazard-library/:id', requirePermission('risk_library.update'), validate(ControlIdParamSchema, 'params'), validate(HazardLibraryUpsertSchema), asyncHandler(ctrl.updateHazardLibraryItem));
router.delete('/hazard-library/:id', requirePermission('risk_library.delete'), validate(ControlIdParamSchema, 'params'), asyncHandler(ctrl.deleteHazardLibraryItem));

router.get('/control-library', requirePermission('risk_library.read'), validate(ListControlLibraryQuerySchema, 'query'), asyncHandler(ctrl.listControlLibrary));
router.post('/control-library', requirePermission('risk_library.create'), validate(ControlLibraryUpsertSchema), asyncHandler(ctrl.createControlLibraryItem));
router.put('/control-library/:id', requirePermission('risk_library.update'), validate(ControlIdParamSchema, 'params'), validate(ControlLibraryUpsertSchema), asyncHandler(ctrl.updateControlLibraryItem));
router.delete('/control-library/:id', requirePermission('risk_library.delete'), validate(ControlIdParamSchema, 'params'), asyncHandler(ctrl.deleteControlLibraryItem));

// ── Controls ────────────────────────────────────────────────────────────────
router.get('/controls', requirePermission('risk_control.read'), validate(ListControlQuerySchema, 'query'), asyncHandler(ctrl.listControls));
router.get('/controls/:id', requirePermission('risk_control.read'), validate(ControlIdParamSchema, 'params'), asyncHandler(ctrl.getControl));
router.get('/risks/:id/controls', requirePermission('risk_control.read'), validate(ControlIdParamSchema, 'params'), asyncHandler(ctrl.listControlsForRisk));
router.post('/risks/:id/controls', requirePermission('risk_control.create'), validate(ControlIdParamSchema, 'params'), validate(ControlCreateSchema), asyncHandler(ctrl.createControl));
router.put('/controls/:id', requirePermission('risk_control.update'), validate(ControlIdParamSchema, 'params'), validate(ControlUpdateSchema), asyncHandler(ctrl.updateControl));
router.patch('/controls/:id', requirePermission('risk_control.update'), validate(ControlIdParamSchema, 'params'), validate(ControlStatusSchema), asyncHandler(ctrl.updateControlStatus));
router.post('/controls/:id/verify', requirePermission('risk_control.approve'), validate(ControlIdParamSchema, 'params'), validate(VerifyControlSchema), asyncHandler(ctrl.verifyControl));
router.delete('/controls/:id', requirePermission('risk_control.delete'), validate(ControlIdParamSchema, 'params'), asyncHandler(ctrl.deleteControl));

// ── Periodic reviews ────────────────────────────────────────────────────────
router.get('/reviews', requirePermission('risk_review.read'), validate(ListReviewQuerySchema, 'query'), asyncHandler(ctrl.listReviews));
router.get('/reviews/:id', requirePermission('risk_review.read'), validate(ControlIdParamSchema, 'params'), asyncHandler(ctrl.getReview));
router.get('/risks/:id/reviews', requirePermission('risk_review.read'), validate(ControlIdParamSchema, 'params'), asyncHandler(ctrl.listReviewsForRisk));
router.post('/risks/:id/reviews', requirePermission('risk_review.create'), validate(ControlIdParamSchema, 'params'), validate(ReviewCreateSchema), asyncHandler(ctrl.createReview));
router.put('/reviews/:id', requirePermission('risk_review.update'), validate(ControlIdParamSchema, 'params'), validate(ReviewCreateSchema), asyncHandler(ctrl.updateReview));
router.post('/reviews/:id/complete', requirePermission('risk_review.update'), validate(ControlIdParamSchema, 'params'), validate(CompleteReviewSchema), asyncHandler(ctrl.completeReview));

// ── Residual-risk acceptance ────────────────────────────────────────────────
router.get('/risks/:id/acceptances', requirePermission('risk.read'), validate(ControlIdParamSchema, 'params'), asyncHandler(ctrl.listAcceptances));
// ── Second-person approval (requiresApproval) ───────────────────────────────
router.get('/risks/:id/approvals', requirePermission('risk.read'), validate(ControlIdParamSchema, 'params'), asyncHandler(ctrl.listApprovals));
router.post('/risks/:id/approvals', requirePermission('risk.update'), validate(ControlIdParamSchema, 'params'), validate(RequestRiskApprovalSchema), asyncHandler(ctrl.requestApproval));
// Deciding is gated on risk.accept, not risk.update: approving is the same
// class of authority as accepting, and must not be handed to every editor.
router.post('/approvals/:id/decide', requirePermission('risk.accept'), validate(ControlIdParamSchema, 'params'), validate(DecideRiskApprovalSchema), asyncHandler(ctrl.decideApproval));

router.post('/risks/:id/accept', requirePermission('risk.accept'), validate(ControlIdParamSchema, 'params'), validate(AcceptRiskSchema), asyncHandler(ctrl.acceptRisk));

export default router;
