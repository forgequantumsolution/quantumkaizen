import { Router } from 'express';
import * as ctrl from './submission.controller';
import {
  FormIdParamSchema,
  ListSubmissionsQuerySchema,
  SubmissionIdParamSchema,
  SubmitFormSchema,
  UpdateSubmissionStatusSchema,
} from './submission.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('form_submission.read'), validate(ListSubmissionsQuerySchema, 'query'), asyncHandler(ctrl.list));
router.get('/:id', requirePermission('form_submission.read'), validate(SubmissionIdParamSchema, 'params'), asyncHandler(ctrl.get));
router.post('/form/:formId', requirePermission('form_submission.create'), validate(FormIdParamSchema, 'params'), validate(SubmitFormSchema), asyncHandler(ctrl.submit));
router.patch('/:id/status', requirePermission('form_submission.update'), validate(SubmissionIdParamSchema, 'params'), validate(UpdateSubmissionStatusSchema), asyncHandler(ctrl.updateStatus));
router.delete('/:id', requirePermission('form_submission.delete'), validate(SubmissionIdParamSchema, 'params'), asyncHandler(ctrl.remove));

export default router;
