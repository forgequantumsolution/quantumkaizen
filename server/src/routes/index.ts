import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import documentRoutes from './document.routes.js';
import nonConformanceRoutes from './nonConformance.routes.js';
import notificationRoutes from './notification.routes.js';
import auditLogRoutes from './auditLog.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import capaRoutes from './capa.routes.js';
import riskRoutes from './risk.routes.js';
import auditMgmtRoutes from './auditMgmt.routes.js';
import fmeaRoutes from './fmea.routes.js';
import complianceRoutes from './compliance.routes.js';
import supplierRoutes from './supplier.routes.js';
import trainingRoutes from './training.routes.js';
import changeControlRoutes from './changeControl.routes.js';
import complaintRoutes from './complaint.routes.js';
import managementReviewRoutes from './managementReview.routes.js';

export const router = Router();

// Auth & Users
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// QMS Module
router.use('/qms/non-conformances', nonConformanceRoutes);
router.use('/qms/capas', capaRoutes);
router.use('/qms/risks', riskRoutes);
router.use('/qms/audits', auditMgmtRoutes);
router.use('/qms/fmea', fmeaRoutes);
router.use('/qms/compliance', complianceRoutes);
router.use('/qms/suppliers', supplierRoutes);
router.use('/qms/change-control', changeControlRoutes);
router.use('/qms/complaints', complaintRoutes);
router.use('/qms/management-review', managementReviewRoutes);

// DMS Module
router.use('/dms/documents', documentRoutes);

// LMS Module
router.use('/lms', trainingRoutes);

// Cross-cutting
router.use('/notifications', notificationRoutes);
router.use('/audit-log', auditLogRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
