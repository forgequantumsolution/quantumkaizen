import { Router } from 'express';
import {
  listDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  submitForReview,
  approveDocument,
  rejectDocument,
  reviseDocument,
  obsoleteDocument,
  acknowledgeDocument,
  listDocumentVersions,
} from '../controllers/document.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', listDocuments);
router.get('/:id', getDocumentById);
router.post('/', requireRole('DOCUMENT_CONTROLLER', 'QUALITY_MANAGER', 'TENANT_ADMIN'), createDocument);
router.put('/:id', updateDocument);
router.post('/:id/submit-for-review', submitForReview);
router.post('/:id/approve', requireRole('QUALITY_MANAGER', 'TENANT_ADMIN', 'DEPARTMENT_HEAD'), approveDocument);
router.post('/:id/reject', rejectDocument);
router.post('/:id/revise', reviseDocument);
router.post('/:id/obsolete', obsoleteDocument);
router.post('/:id/acknowledge', acknowledgeDocument);
router.get('/:id/versions', listDocumentVersions);

export default router;
