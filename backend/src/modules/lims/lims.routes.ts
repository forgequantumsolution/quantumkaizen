/**
 * LIMS routes — mounted at /api/lims.
 *   GET/POST           /labs
 *   GET/PUT/DELETE     /labs/:id
 */
import { Router } from 'express';
import * as ctrl from './lims.controller';
import * as eq from './equipment.controller';
import * as cert from './certification.controller';
import * as method from './method.controller';
import * as spec from './specification.controller';
import { IdParamSchema, LabUpsertSchema, ListLabsQuerySchema } from './lims.schema';
import { EquipmentUpsertSchema, ListEquipmentQuerySchema, RecordCalibrationSchema } from './equipment.schema';
import { CertUpsertSchema, ListCertQuerySchema } from './certification.schema';
import { ListMethodQuerySchema, MethodUpsertSchema } from './method.schema';
import { ListSpecQuerySchema, SpecUpsertSchema } from './specification.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

// ── Labs ──
router.get('/labs', requirePermission('lab.read'), validate(ListLabsQuerySchema, 'query'), asyncHandler(ctrl.listLabs));
router.get('/labs/:id', requirePermission('lab.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getLab));
router.post('/labs', requirePermission('lab.create'), validate(LabUpsertSchema), asyncHandler(ctrl.createLab));
router.put('/labs/:id', requirePermission('lab.update'), validate(IdParamSchema, 'params'), validate(LabUpsertSchema), asyncHandler(ctrl.updateLab));
router.delete('/labs/:id', requirePermission('lab.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteLab));

// ── Equipment & calibration ──
router.get('/equipment', requirePermission('equipment.read'), validate(ListEquipmentQuerySchema, 'query'), asyncHandler(eq.list));
router.get('/equipment/:id', requirePermission('equipment.read'), validate(IdParamSchema, 'params'), asyncHandler(eq.get));
router.post('/equipment', requirePermission('equipment.create'), validate(EquipmentUpsertSchema), asyncHandler(eq.create));
router.put('/equipment/:id', requirePermission('equipment.update'), validate(IdParamSchema, 'params'), validate(EquipmentUpsertSchema), asyncHandler(eq.update));
router.delete('/equipment/:id', requirePermission('equipment.delete'), validate(IdParamSchema, 'params'), asyncHandler(eq.remove));
router.post('/equipment/:id/calibrations', requirePermission('equipment.update'), validate(IdParamSchema, 'params'), validate(RecordCalibrationSchema), asyncHandler(eq.recordCalibration));

// ── Certifications ──
router.get('/certifications', requirePermission('certification.read'), validate(ListCertQuerySchema, 'query'), asyncHandler(cert.list));
router.get('/certifications/:id', requirePermission('certification.read'), validate(IdParamSchema, 'params'), asyncHandler(cert.get));
router.post('/certifications', requirePermission('certification.create'), validate(CertUpsertSchema), asyncHandler(cert.create));
router.put('/certifications/:id', requirePermission('certification.update'), validate(IdParamSchema, 'params'), validate(CertUpsertSchema), asyncHandler(cert.update));
router.delete('/certifications/:id', requirePermission('certification.delete'), validate(IdParamSchema, 'params'), asyncHandler(cert.remove));

// ── Test Methods ──
router.get('/methods', requirePermission('method.read'), validate(ListMethodQuerySchema, 'query'), asyncHandler(method.list));
router.get('/methods/:id', requirePermission('method.read'), validate(IdParamSchema, 'params'), asyncHandler(method.get));
router.post('/methods', requirePermission('method.create'), validate(MethodUpsertSchema), asyncHandler(method.create));
router.put('/methods/:id', requirePermission('method.update'), validate(IdParamSchema, 'params'), validate(MethodUpsertSchema), asyncHandler(method.update));
router.delete('/methods/:id', requirePermission('method.delete'), validate(IdParamSchema, 'params'), asyncHandler(method.remove));

// ── Specification Library ──
router.get('/specifications', requirePermission('specification.read'), validate(ListSpecQuerySchema, 'query'), asyncHandler(spec.list));
router.get('/specifications/:id', requirePermission('specification.read'), validate(IdParamSchema, 'params'), asyncHandler(spec.get));
router.post('/specifications', requirePermission('specification.create'), validate(SpecUpsertSchema), asyncHandler(spec.create));
router.put('/specifications/:id', requirePermission('specification.update'), validate(IdParamSchema, 'params'), validate(SpecUpsertSchema), asyncHandler(spec.update));
router.post('/specifications/:id/approve', requirePermission('specification.approve'), validate(IdParamSchema, 'params'), asyncHandler(spec.approve));
router.post('/specifications/:id/retire', requirePermission('specification.approve'), validate(IdParamSchema, 'params'), asyncHandler(spec.retire));
router.delete('/specifications/:id', requirePermission('specification.delete'), validate(IdParamSchema, 'params'), asyncHandler(spec.remove));

export default router;
