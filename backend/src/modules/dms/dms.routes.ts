/**
 * DMS routes — mounted at /api/dms.
 *   GET    /documents
 *   GET    /documents/:id
 *   POST   /documents
 *   PUT    /documents/:id
 *   PUT    /documents/:id/content      (save online-editor content)
 *   POST   /documents/:id/revise       (start a new draft revision)
 *   POST   /documents/:id/issue        (make effective)
 *   POST   /documents/:id/retire
 *   DELETE /documents/:id              (DRAFT only)
 */
import { Router } from 'express';
import * as ctrl from './dms.controller';
import { auditAccess } from '../../middleware/audit-access';
import {
  ApproveSchema,
  AssignReadersSchema,
  CreateDocumentSchema,
  IdParamSchema,
  IssueSchema,
  ListDocumentsQuerySchema,
  MarkReviewedSchema,
  RejectSchema,
  ReviseSchema,
  SaveContentSchema,
  SubmitSchema,
  UpdateDocumentSchema,
} from './dms.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

router.get(
  '/documents',
  requirePermission('document.read'),
  validate(ListDocumentsQuerySchema, 'query'),
  asyncHandler(ctrl.list),
);
router.get(
  '/documents/:id',
  requirePermission('document.read'),
  validate(IdParamSchema, 'params'),
  // Controlled-document content is served inline here, so opening the record is
  // the access event worth recording.
  auditAccess('Document', 'DMS'),
  asyncHandler(ctrl.get),
);
router.post(
  '/documents',
  requirePermission('document.create'),
  validate(CreateDocumentSchema),
  asyncHandler(ctrl.create),
);
router.put(
  '/documents/:id',
  requirePermission('document.update'),
  validate(IdParamSchema, 'params'),
  validate(UpdateDocumentSchema),
  asyncHandler(ctrl.update),
);
router.put(
  '/documents/:id/content',
  requirePermission('document.update'),
  validate(IdParamSchema, 'params'),
  validate(SaveContentSchema),
  asyncHandler(ctrl.saveContent),
);
router.post(
  '/documents/:id/revise',
  requirePermission('document.update'),
  validate(IdParamSchema, 'params'),
  validate(ReviseSchema),
  asyncHandler(ctrl.revise),
);
router.post(
  '/documents/:id/issue',
  requirePermission('document.issue'),
  validate(IdParamSchema, 'params'),
  validate(IssueSchema),
  asyncHandler(ctrl.issue),
);
router.post(
  '/documents/:id/submit',
  requirePermission('document.update'),
  validate(IdParamSchema, 'params'),
  validate(SubmitSchema),
  asyncHandler(ctrl.submit),
);
router.post(
  '/documents/:id/approve',
  requirePermission('document.approve'),
  validate(IdParamSchema, 'params'),
  validate(ApproveSchema),
  asyncHandler(ctrl.approve),
);
router.post(
  '/documents/:id/reject',
  requirePermission('document.approve'),
  validate(IdParamSchema, 'params'),
  validate(RejectSchema),
  asyncHandler(ctrl.reject),
);
router.post(
  '/documents/:id/retire',
  requirePermission('document.issue'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.retire),
);
router.delete(
  '/documents/:id',
  requirePermission('document.delete'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.remove),
);

// Periodic review + controlled distribution (read & understood)
router.post(
  '/documents/:id/review',
  requirePermission('document.issue'),
  validate(IdParamSchema, 'params'),
  validate(MarkReviewedSchema),
  asyncHandler(ctrl.markReviewed),
);
router.post(
  '/documents/:id/readers',
  requirePermission('document.issue'),
  validate(IdParamSchema, 'params'),
  validate(AssignReadersSchema),
  asyncHandler(ctrl.assignReaders),
);
router.get(
  '/documents/:id/receipts',
  requirePermission('document.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.receipts),
);
router.post(
  '/documents/:id/acknowledge',
  requirePermission('document.read'),
  validate(IdParamSchema, 'params'),
  asyncHandler(ctrl.acknowledge),
);
// "My pending reads" across all documents.
router.get('/my-reads', requirePermission('document.read'), asyncHandler(ctrl.myReads));

export default router;
