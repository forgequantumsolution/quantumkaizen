import { Router } from 'express';
import * as ctrl from './audit.controller';
import {
  AuditScheduleUpsertSchema,
  IdParamSchema,
  IsoUpsertSchema,
  ListAuditQuerySchema,
  ListIsoQuerySchema,
  ScheduleIdParamSchema,
  UpdateAuditDateSchema,
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

// Audit schedules
router.get('/get_audit_schedules_with_info', requirePermission('audit_schedule.read'), validate(ListAuditQuerySchema, 'query'), asyncHandler(ctrl.listSchedules));
router.get('/get_audit_schedule_filters', requirePermission('audit_schedule.read'), asyncHandler(ctrl.filters));
router.post('/audit_schedules', requirePermission('audit_schedule.create'), validate(AuditScheduleUpsertSchema), asyncHandler(ctrl.createSchedule));
router.put('/audit_schedules/:id', requirePermission('audit_schedule.update'), validate(IdParamSchema, 'params'), validate(AuditScheduleUpsertSchema), asyncHandler(ctrl.updateSchedule));
router.patch('/update_audit_date/:scheduleId/', requirePermission('audit_schedule.update'), validate(ScheduleIdParamSchema, 'params'), validate(UpdateAuditDateSchema), asyncHandler(ctrl.updateScheduleDate));
router.delete('/audit_schedules/:id', requirePermission('audit_schedule.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteSchedule));

export default router;
