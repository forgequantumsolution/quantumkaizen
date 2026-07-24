/** LIMS 2.0 — Certificate of Analysis (authed), mounted at /api/coa. */
import { Router } from 'express';
import * as ctrl from './coa.controller';
import { CoaTemplateUpsertSchema, GenerateCoaSchema, IssueCoaSchema, RevokeCoaSchema, ListCoaQuerySchema, ListTemplateQuerySchema, IdParamSchema } from './coa.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { auditAccess } from '../../middleware/audit-access';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

// Templates
router.get('/templates', requirePermission('coa.read'), validate(ListTemplateQuerySchema, 'query'), asyncHandler(ctrl.listTemplates));
router.post('/templates', requirePermission('coa.manage'), validate(CoaTemplateUpsertSchema), asyncHandler(ctrl.createTemplate));
router.put('/templates/:id', requirePermission('coa.manage'), validate(IdParamSchema, 'params'), validate(CoaTemplateUpsertSchema), asyncHandler(ctrl.updateTemplate));
router.delete('/templates/:id', requirePermission('coa.manage'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.removeTemplate));

// Certificates
router.get('/', requirePermission('coa.read'), validate(ListCoaQuerySchema, 'query'), asyncHandler(ctrl.list));
router.post('/generate', requirePermission('coa.create'), validate(GenerateCoaSchema), asyncHandler(ctrl.generate));
router.get('/:id', requirePermission('coa.read'), validate(IdParamSchema, 'params'), auditAccess('Coa', 'LIMS'), asyncHandler(ctrl.get));
router.post('/:id/issue', requirePermission('coa.issue'), validate(IdParamSchema, 'params'), validate(IssueCoaSchema), asyncHandler(ctrl.issue));
router.post('/:id/revoke', requirePermission('coa.issue'), validate(IdParamSchema, 'params'), validate(RevokeCoaSchema), asyncHandler(ctrl.revoke));

export default router;
