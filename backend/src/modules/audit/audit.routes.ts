import { Router } from 'express';
import * as ctrl from './audit.controller';
import * as registerCtrl from './audit-register.controller';
import {
  AuditScheduleUpsertSchema,
  IdParamSchema,
  IsoUpsertSchema,
  ListAuditQuerySchema,
  ListIsoQuerySchema,
  ScheduleIdParamSchema,
  UpdateAuditDateSchema,
  AuditMasterUpsertSchema,
  AuditRegisterUpsertSchema,
  RejectAuditRegisterSchema,
  FocusAreaUpsertSchema,
  ListFocusAreaQuerySchema,
  AuditTypeMasterUpsertSchema,
  ListAuditTypeMasterQuerySchema,
  ListAuditMasterQuerySchema,
  ListAuditRegisterQuerySchema,
  ListAuditProgramQuerySchema,
  StartAuditProgramSchema,
  CompleteAuditProgramSchema,
  FindingUpsertSchema,
  ListFindingQuerySchema,
  PromoteFindingToNcSchema,
  ListNcQuerySchema,
  RaiseCapaSchema,
  UpdateNcStatusSchema,
} from './audit.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

// ISO standards (frontend uses /api/get_complete_iso_standards etc.)
router.get('/get_complete_iso_standards', requirePermission('iso_standard.read'), validate(ListIsoQuerySchema, 'query'), asyncHandler(ctrl.listIso));
router.post('/add_iso_standard', requirePermission('iso_standard.create'), validate(IsoUpsertSchema), asyncHandler(ctrl.createIso));
router.put('/update_iso_standard/:id/', requirePermission('iso_standard.update'), validate(IdParamSchema, 'params'), validate(IsoUpsertSchema), asyncHandler(ctrl.updateIso));
router.delete('/delete_iso_standard/:id/', requirePermission('iso_standard.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteIso));

// Audit schedules (legacy)
router.get('/get_audit_schedules_with_info', requirePermission('audit_schedule.read'), validate(ListAuditQuerySchema, 'query'), asyncHandler(ctrl.listSchedules));
router.get('/get_audit_schedule_filters', requirePermission('audit_schedule.read'), asyncHandler(ctrl.filters));
router.post('/audit_schedules', requirePermission('audit_schedule.create'), validate(AuditScheduleUpsertSchema), asyncHandler(ctrl.createSchedule));
router.put('/audit_schedules/:id', requirePermission('audit_schedule.update'), validate(IdParamSchema, 'params'), validate(AuditScheduleUpsertSchema), asyncHandler(ctrl.updateSchedule));
router.patch('/update_audit_date/:scheduleId/', requirePermission('audit_schedule.update'), validate(ScheduleIdParamSchema, 'params'), validate(UpdateAuditDateSchema), asyncHandler(ctrl.updateScheduleDate));
router.delete('/audit_schedules/:id', requirePermission('audit_schedule.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteSchedule));

// ============================================================
// Audit Master / Register / Program / Finding / Non-Conformance
// Mounted at /api/audit/* (parent router is mounted at /api).
// ============================================================

// ── Audit Master ──
router.get('/audit/masters', requirePermission('audit_master.read'), validate(ListAuditMasterQuerySchema, 'query'), asyncHandler(registerCtrl.listMasters));
router.post('/audit/masters', requirePermission('audit_master.create'), validate(AuditMasterUpsertSchema), asyncHandler(registerCtrl.createMaster));
router.put('/audit/masters/:id', requirePermission('audit_master.update'), validate(IdParamSchema, 'params'), validate(AuditMasterUpsertSchema), asyncHandler(registerCtrl.updateMaster));
router.delete('/audit/masters/:id', requirePermission('audit_master.delete'), validate(IdParamSchema, 'params'), asyncHandler(registerCtrl.deleteMaster));

// ── Focus Area (lookup master) ──
router.get('/audit/focus-areas', requirePermission('focus_area.read'), validate(ListFocusAreaQuerySchema, 'query'), asyncHandler(registerCtrl.listFocusAreas));
router.post('/audit/focus-areas', requirePermission('focus_area.create'), validate(FocusAreaUpsertSchema), asyncHandler(registerCtrl.createFocusArea));
router.put('/audit/focus-areas/:id', requirePermission('focus_area.update'), validate(IdParamSchema, 'params'), validate(FocusAreaUpsertSchema), asyncHandler(registerCtrl.updateFocusArea));
router.delete('/audit/focus-areas/:id', requirePermission('focus_area.delete'), validate(IdParamSchema, 'params'), asyncHandler(registerCtrl.deleteFocusArea));

// ── Audit Type (lookup master) ──
router.get('/audit/audit-types', requirePermission('audit_type.read'), validate(ListAuditTypeMasterQuerySchema, 'query'), asyncHandler(registerCtrl.listAuditTypes));
router.post('/audit/audit-types', requirePermission('audit_type.create'), validate(AuditTypeMasterUpsertSchema), asyncHandler(registerCtrl.createAuditType));
router.put('/audit/audit-types/:id', requirePermission('audit_type.update'), validate(IdParamSchema, 'params'), validate(AuditTypeMasterUpsertSchema), asyncHandler(registerCtrl.updateAuditType));
router.delete('/audit/audit-types/:id', requirePermission('audit_type.delete'), validate(IdParamSchema, 'params'), asyncHandler(registerCtrl.deleteAuditType));

// ── Audit Register ──
router.get('/audit/registers', requirePermission('audit_register.read'), validate(ListAuditRegisterQuerySchema, 'query'), asyncHandler(registerCtrl.listRegisters));
router.get('/audit/registers/:id', requirePermission('audit_register.read'), validate(IdParamSchema, 'params'), asyncHandler(registerCtrl.getRegister));
router.post('/audit/registers', requirePermission('audit_register.create'), validate(AuditRegisterUpsertSchema), asyncHandler(registerCtrl.createRegister));
router.put('/audit/registers/:id', requirePermission('audit_register.update'), validate(IdParamSchema, 'params'), validate(AuditRegisterUpsertSchema), asyncHandler(registerCtrl.updateRegister));
router.post('/audit/registers/:id/submit', requirePermission('audit_register.update'), validate(IdParamSchema, 'params'), asyncHandler(registerCtrl.submitRegister));
router.post('/audit/registers/:id/approve', requirePermission('audit_register.approve'), validate(IdParamSchema, 'params'), asyncHandler(registerCtrl.approveRegister));
router.post('/audit/registers/:id/reject', requirePermission('audit_register.approve'), validate(IdParamSchema, 'params'), validate(RejectAuditRegisterSchema), asyncHandler(registerCtrl.rejectRegister));
router.delete('/audit/registers/:id', requirePermission('audit_register.delete'), validate(IdParamSchema, 'params'), asyncHandler(registerCtrl.deleteRegister));

// ── Audit Program ──
router.get('/audit/programs', requirePermission('audit_program.read'), validate(ListAuditProgramQuerySchema, 'query'), asyncHandler(registerCtrl.listPrograms));
router.get('/audit/programs/:id', requirePermission('audit_program.read'), validate(IdParamSchema, 'params'), asyncHandler(registerCtrl.getProgram));
router.post('/audit/programs/:id/start', requirePermission('audit_program.execute'), validate(IdParamSchema, 'params'), validate(StartAuditProgramSchema), asyncHandler(registerCtrl.startProgram));
router.post('/audit/programs/:id/complete', requirePermission('audit_program.execute'), validate(IdParamSchema, 'params'), validate(CompleteAuditProgramSchema), asyncHandler(registerCtrl.completeProgram));

// ── Findings ──
router.get('/audit/findings', requirePermission('audit_finding.read'), validate(ListFindingQuerySchema, 'query'), asyncHandler(registerCtrl.listFindings));
router.post('/audit/findings', requirePermission('audit_finding.create'), validate(FindingUpsertSchema), asyncHandler(registerCtrl.createFinding));
router.put('/audit/findings/:id', requirePermission('audit_finding.update'), validate(IdParamSchema, 'params'), validate(FindingUpsertSchema), asyncHandler(registerCtrl.updateFinding));
router.delete('/audit/findings/:id', requirePermission('audit_finding.delete'), validate(IdParamSchema, 'params'), asyncHandler(registerCtrl.deleteFinding));

// ── Non-Conformance ──
router.post('/audit/findings/:findingId/promote-nc', requirePermission('non_conformance.create'), validate(PromoteFindingToNcSchema), asyncHandler(registerCtrl.promoteToNc));
router.get('/audit/non-conformances', requirePermission('non_conformance.read'), validate(ListNcQuerySchema, 'query'), asyncHandler(registerCtrl.listNcs));
router.post('/audit/non-conformances/:id/raise-capa', requirePermission('non_conformance.update'), validate(IdParamSchema, 'params'), validate(RaiseCapaSchema), asyncHandler(registerCtrl.raiseCapa));
router.patch('/audit/non-conformances/:id/status', requirePermission('non_conformance.update'), validate(IdParamSchema, 'params'), validate(UpdateNcStatusSchema), asyncHandler(registerCtrl.updateNcStatus));

export default router;
