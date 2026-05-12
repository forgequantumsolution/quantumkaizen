import { Router } from 'express';
import * as ctrl from './dynamic-form.controller';
import {
  CreateFormSchema,
  FieldTypeUpsertSchema,
  FormTypeUpsertSchema,
  IdParamSchema,
  ListFormsQuerySchema,
  SaveDraftSchema,
  SaveFormFieldsSchema,
} from './dynamic-form.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

// Forms
router.get('/form/get/', requirePermission('form.read'), validate(ListFormsQuerySchema, 'query'), asyncHandler(ctrl.listForms));
router.get('/form/with_sections/', requirePermission('form.read'), validate(ListFormsQuerySchema, 'query'), asyncHandler(ctrl.listForms));
router.get('/form/fields/get/:id/', requirePermission('form.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getFormFields));
router.get('/form_draft/get/:id/', requirePermission('form.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getFormDraft));

router.post('/form/create/', requirePermission('form.create'), validate(CreateFormSchema), asyncHandler(ctrl.createForm));
router.post('/form/fields/create/:id/', requirePermission('form.update'), validate(IdParamSchema, 'params'), validate(SaveFormFieldsSchema), asyncHandler(ctrl.saveFormFields));
router.post('/form_draft/save/:id/', requirePermission('form.update'), validate(IdParamSchema, 'params'), validate(SaveDraftSchema), asyncHandler(ctrl.saveDraft));
router.delete('/form/delete/:id/', requirePermission('form.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteForm));

// Form types (checklist categories)
router.get('/form_types/', requirePermission('form.read'), asyncHandler(ctrl.listFormTypes));
router.post('/form_types/create/', requirePermission('form_type.create'), validate(FormTypeUpsertSchema), asyncHandler(ctrl.createFormType));
router.put('/form_types/:id/update/', requirePermission('form_type.update'), validate(IdParamSchema, 'params'), validate(FormTypeUpsertSchema), asyncHandler(ctrl.updateFormType));
router.delete('/form_types/:id/delete/', requirePermission('form_type.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteFormType));

// Field types
router.get('/field_types/', requirePermission('form.read'), asyncHandler(ctrl.listFieldTypes));
router.post('/field_types/create/', requirePermission('field_type.create'), validate(FieldTypeUpsertSchema), asyncHandler(ctrl.createFieldType));
router.put('/field_types/update/:id/', requirePermission('field_type.update'), validate(IdParamSchema, 'params'), validate(FieldTypeUpsertSchema), asyncHandler(ctrl.updateFieldType));
router.delete('/field_types/delete/:id/', requirePermission('field_type.delete'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteFieldType));

// Lookups
router.get('/data_types/', requirePermission('form.read'), asyncHandler(ctrl.listDataTypes));
router.get('/main_processes/', requirePermission('form.read'), asyncHandler(ctrl.listMainProcesses));
router.get('/criteria/', requirePermission('form.read'), asyncHandler(ctrl.listCriteria));

export default router;
