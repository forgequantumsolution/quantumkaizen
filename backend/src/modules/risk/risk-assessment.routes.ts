/**
 * Risk assessment routes — mounted under /api/risk alongside risk.routes.ts.
 *
 * Paths are relative on purpose: this router owns the /assessments and /lines
 * surface only, so it can be mounted wherever the module is mounted.
 *
 * Approve and reject sit behind their own `risk_assessment.approve` key — the
 * segregation of duties an inspector expects between the people who write a
 * risk assessment and the people who sign it off.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './risk-assessment.controller';
import { IdParamSchema } from './risk.schema';
import {
  ApproveAssessmentSchema,
  AssessmentCreateSchema,
  AssessmentUpdateSchema,
  BulkLinesSchema,
  LineUpsertSchema,
  ListAssessmentQuerySchema,
  ListLineQuerySchema,
  PromoteLineSchema,
  RejectAssessmentSchema,
  ReviseAssessmentSchema,
  UpdateAssessmentStatusSchema,
} from './risk-assessment.schema';

const router = Router();

router.use(requireAuth);

// ── Assessments ─────────────────────────────────────────────────────────────
router.get('/assessments', requirePermission('risk_assessment.read'), validate(ListAssessmentQuerySchema, 'query'), asyncHandler(ctrl.listAssessments));
router.get('/assessments/:id', requirePermission('risk_assessment.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getAssessment));
router.post('/assessments', requirePermission('risk_assessment.create'), validate(AssessmentCreateSchema), asyncHandler(ctrl.createAssessment));
router.put('/assessments/:id', requirePermission('risk_assessment.update'), validate(IdParamSchema, 'params'), validate(AssessmentUpdateSchema), asyncHandler(ctrl.updateAssessment));
router.delete('/assessments/:id', requirePermission('risk_assessment.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteAssessment));

// ── Lifecycle ───────────────────────────────────────────────────────────────
router.patch('/assessments/:id/status', requirePermission('risk_assessment.update'), validate(IdParamSchema, 'params'), validate(UpdateAssessmentStatusSchema), asyncHandler(ctrl.updateAssessmentStatus));
router.post('/assessments/:id/approve', requirePermission('risk_assessment.approve'), validate(IdParamSchema, 'params'), validate(ApproveAssessmentSchema), asyncHandler(ctrl.approveAssessment));
router.post('/assessments/:id/reject', requirePermission('risk_assessment.approve'), validate(IdParamSchema, 'params'), validate(RejectAssessmentSchema), asyncHandler(ctrl.rejectAssessment));
router.post('/assessments/:id/revise', requirePermission('risk_assessment.create'), validate(IdParamSchema, 'params'), validate(ReviseAssessmentSchema), asyncHandler(ctrl.reviseAssessment));

// ── Worksheet lines — the bulk path is declared before the plain one so the
//    literal /lines/bulk segment always wins. ─────────────────────────────────
router.post('/assessments/:id/lines/bulk', requirePermission('risk_assessment.update'), validate(IdParamSchema, 'params'), validate(BulkLinesSchema), asyncHandler(ctrl.saveLinesBulk));
router.get('/assessments/:id/lines', requirePermission('risk_assessment.read'), validate(IdParamSchema, 'params'), validate(ListLineQuerySchema, 'query'), asyncHandler(ctrl.listLines));
router.post('/assessments/:id/lines', requirePermission('risk_assessment.update'), validate(IdParamSchema, 'params'), validate(LineUpsertSchema), asyncHandler(ctrl.createLine));
router.put('/lines/:id', requirePermission('risk_assessment.update'), validate(IdParamSchema, 'params'), validate(LineUpsertSchema), asyncHandler(ctrl.updateLine));
router.delete('/lines/:id', requirePermission('risk_assessment.update'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteLine));

// Promotion writes into the risk register, so it carries the register's key.
router.post('/lines/:id/promote', requirePermission('risk.create'), validate(IdParamSchema, 'params'), validate(PromoteLineSchema), asyncHandler(ctrl.promoteLine));

export default router;
