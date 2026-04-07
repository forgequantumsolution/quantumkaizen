import prisma from '../lib/prisma.js';
import logger from '../config/logger.js';
import { createNotification } from '../services/notification.service.js';
import { sendEmail, recordOverdueTemplate } from '../services/email.service.js';
import crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────

interface JobResult {
  jobName: string;
  processedCount: number;
  errors: string[];
  completedAt: string;
}

// ─── Check Overdue Actions ───────────────────────────────────────────
// Finds overdue CAPAs and NCs, sends notifications to owners and managers.

export async function checkOverdueActions(): Promise<JobResult> {
  const jobName = 'checkOverdueActions';
  logger.info(`[${jobName}] Starting overdue actions check`);

  const errors: string[] = [];
  let processedCount = 0;
  const now = new Date();

  try {
    // Find overdue NCs
    const overdueNCs = await prisma.nonConformance.findMany({
      where: {
        status: { notIn: ['CLOSED'] },
        dueDate: { lt: now },
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, tenantId: true } },
        reportedBy: { select: { id: true, name: true } },
        tenant: { select: { id: true } },
      },
    });

    for (const nc of overdueNCs) {
      try {
        if (nc.assignedTo) {
          const daysPastDue = Math.ceil(
            (now.getTime() - (nc.dueDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)
          );

          await createNotification({
            tenantId: nc.tenant.id,
            userId: nc.assignedTo.id,
            type: 'OVERDUE',
            title: `Non-Conformance Overdue: ${nc.ncNumber}`,
            message: `NC "${nc.title}" is ${daysPastDue} day(s) past due.`,
            entityType: 'NON_CONFORMANCE',
            entityId: nc.id,
          });

          // Send email notification
          const template = recordOverdueTemplate({
            recipientName: nc.assignedTo.name,
            entityType: 'Non-Conformance',
            entityTitle: nc.title,
            entityNumber: nc.ncNumber,
            dueDate: nc.dueDate?.toISOString().split('T')[0] || 'N/A',
            daysPastDue,
          });

          await sendEmail(nc.assignedTo.email, template.subject, template.html).catch((err) => {
            errors.push(`Email failed for NC ${nc.ncNumber}: ${err.message}`);
          });

          processedCount++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`NC ${nc.ncNumber}: ${msg}`);
      }
    }

    // Find overdue CAPAs
    const overdueCAPAs = await prisma.cAPA.findMany({
      where: {
        status: { notIn: ['CLOSED'] },
        dueDate: { lt: now },
      },
      include: {
        owner: { select: { id: true, name: true, email: true, tenantId: true } },
        tenant: { select: { id: true } },
      },
    });

    for (const capa of overdueCAPAs) {
      try {
        const daysPastDue = Math.ceil(
          (now.getTime() - (capa.dueDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)
        );

        await createNotification({
          tenantId: capa.tenant.id,
          userId: capa.owner.id,
          type: 'OVERDUE',
          title: `CAPA Overdue: ${capa.capaNumber}`,
          message: `CAPA "${capa.title}" is ${daysPastDue} day(s) past due.`,
          entityType: 'CAPA',
          entityId: capa.id,
        });

        const template = recordOverdueTemplate({
          recipientName: capa.owner.name,
          entityType: 'CAPA',
          entityTitle: capa.title,
          entityNumber: capa.capaNumber,
          dueDate: capa.dueDate?.toISOString().split('T')[0] || 'N/A',
          daysPastDue,
        });

        await sendEmail(capa.owner.email, template.subject, template.html).catch((err) => {
          errors.push(`Email failed for CAPA ${capa.capaNumber}: ${err.message}`);
        });

        processedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`CAPA ${capa.capaNumber}: ${msg}`);
      }
    }

    // Find overdue CAPA actions
    const overdueActions = await prisma.cAPAAction.findMany({
      where: {
        completionDate: null,
        dueDate: { lt: now },
      },
      include: {
        capa: {
          select: { capaNumber: true, title: true, tenantId: true },
        },
      },
    });

    for (const action of overdueActions) {
      try {
        await createNotification({
          tenantId: action.capa.tenantId,
          userId: action.ownerId,
          type: 'OVERDUE',
          title: `CAPA Action Overdue: ${action.capa.capaNumber}`,
          message: `Action "${action.description}" for CAPA "${action.capa.title}" is overdue.`,
          entityType: 'CAPA',
          entityId: action.capaId,
        });
        processedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`CAPA Action ${action.id}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Fatal: ${msg}`);
    logger.error(`[${jobName}] Fatal error`, { error: err });
  }

  logger.info(`[${jobName}] Completed`, { processedCount, errorCount: errors.length });
  return { jobName, processedCount, errors, completedAt: new Date().toISOString() };
}

// ─── Check Expiring Documents ────────────────────────────────────────
// Finds documents expiring within 30 or 60 days and notifies owners.

export async function checkExpiringDocuments(): Promise<JobResult> {
  const jobName = 'checkExpiringDocuments';
  logger.info(`[${jobName}] Starting expiring documents check`);

  const errors: string[] = [];
  let processedCount = 0;
  const now = new Date();
  const thirtyDays = new Date(now);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const sixtyDays = new Date(now);
  sixtyDays.setDate(sixtyDays.getDate() + 60);

  try {
    const expiringDocuments = await prisma.document.findMany({
      where: {
        status: 'PUBLISHED',
        expiryDate: { lte: sixtyDays, gt: now },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true } },
      },
    });

    for (const doc of expiringDocuments) {
      try {
        const daysUntilExpiry = Math.ceil(
          (doc.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const urgency = daysUntilExpiry <= 30 ? 'URGENT' : 'WARNING';

        await createNotification({
          tenantId: doc.tenant.id,
          userId: doc.owner.id,
          type: 'EXPIRY_WARNING',
          title: `${urgency}: Document Expiring — ${doc.documentNumber}`,
          message: `Document "${doc.title}" will expire in ${daysUntilExpiry} day(s) on ${doc.expiryDate!.toISOString().split('T')[0]}.`,
          entityType: 'DOCUMENT',
          entityId: doc.id,
        });

        processedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Document ${doc.documentNumber}: ${msg}`);
      }
    }

    // Also check review dates
    const reviewDueDocs = await prisma.document.findMany({
      where: {
        status: 'PUBLISHED',
        reviewDate: { lte: thirtyDays, gt: now },
      },
      include: {
        owner: { select: { id: true, name: true } },
        tenant: { select: { id: true } },
      },
    });

    for (const doc of reviewDueDocs) {
      try {
        const daysUntilReview = Math.ceil(
          (doc.reviewDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        await createNotification({
          tenantId: doc.tenant.id,
          userId: doc.owner.id,
          type: 'EXPIRY_WARNING',
          title: `Document Review Due: ${doc.documentNumber}`,
          message: `Document "${doc.title}" is due for review in ${daysUntilReview} day(s).`,
          entityType: 'DOCUMENT',
          entityId: doc.id,
        });

        processedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Document review ${doc.documentNumber}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Fatal: ${msg}`);
    logger.error(`[${jobName}] Fatal error`, { error: err });
  }

  logger.info(`[${jobName}] Completed`, { processedCount, errorCount: errors.length });
  return { jobName, processedCount, errors, completedAt: new Date().toISOString() };
}

// ─── Check Expiring Certifications ──────────────────────────────────
// Finds training certifications that are expiring soon.

export async function checkExpiringCertifications(): Promise<JobResult> {
  const jobName = 'checkExpiringCertifications';
  logger.info(`[${jobName}] Starting expiring certifications check`);

  const errors: string[] = [];
  let processedCount = 0;
  const now = new Date();
  const thirtyDays = new Date(now);
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  try {
    const expiringCerts = await prisma.trainingAssignment.findMany({
      where: {
        status: 'COMPLETED',
        expiresAt: { lte: thirtyDays, gt: now },
      },
      include: {
        program: {
          select: { title: true, tenantId: true },
        },
      },
    });

    for (const cert of expiringCerts) {
      try {
        const daysUntilExpiry = Math.ceil(
          (cert.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        await createNotification({
          tenantId: cert.program.tenantId,
          userId: cert.userId,
          type: 'EXPIRY_WARNING',
          title: `Training Certification Expiring: ${cert.program.title}`,
          message: `Your certification for "${cert.program.title}" will expire in ${daysUntilExpiry} day(s). Please schedule a refresher.`,
          entityType: 'TRAINING',
          entityId: cert.programId,
        });

        // Update status to EXPIRED if past due
        if (cert.expiresAt && cert.expiresAt <= now) {
          await prisma.trainingAssignment.update({
            where: { id: cert.id },
            data: { status: 'EXPIRED' },
          });
        }

        processedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Cert ${cert.id}: ${msg}`);
      }
    }

    // Also check overdue training assignments
    const overdueTraining = await prisma.trainingAssignment.findMany({
      where: {
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        dueDate: { lt: now },
      },
      include: {
        program: { select: { title: true, tenantId: true } },
      },
    });

    for (const assignment of overdueTraining) {
      try {
        await prisma.trainingAssignment.update({
          where: { id: assignment.id },
          data: { status: 'OVERDUE' },
        });

        await createNotification({
          tenantId: assignment.program.tenantId,
          userId: assignment.userId,
          type: 'OVERDUE',
          title: `Training Overdue: ${assignment.program.title}`,
          message: `Your training "${assignment.program.title}" is overdue. Please complete it immediately.`,
          entityType: 'TRAINING',
          entityId: assignment.programId,
        });

        processedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Training ${assignment.id}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Fatal: ${msg}`);
    logger.error(`[${jobName}] Fatal error`, { error: err });
  }

  logger.info(`[${jobName}] Completed`, { processedCount, errorCount: errors.length });
  return { jobName, processedCount, errors, completedAt: new Date().toISOString() };
}

// ─── Check Audit Signature Integrity ─────────────────────────────────
// Verifies that stored electronic signatures have not been tampered with.

export async function checkAuditSignatureIntegrity(): Promise<JobResult> {
  const jobName = 'checkAuditSignatureIntegrity';
  logger.info(`[${jobName}] Starting signature integrity check`);

  const errors: string[] = [];
  let processedCount = 0;

  try {
    const signatures = await prisma.electronicSignature.findMany({
      orderBy: { timestampUtc: 'desc' },
      take: 1000,
    });

    for (const sig of signatures) {
      try {
        // Recompute the signature hash from the stored fields
        const dataToHash = [
          sig.userId,
          sig.userName,
          sig.userRole,
          sig.meaning,
          sig.entityType,
          sig.entityId,
          sig.entityVersion,
          sig.timestampUtc.toISOString(),
        ].join('|');

        const expectedHash = crypto
          .createHash('sha256')
          .update(dataToHash)
          .digest('hex');

        if (sig.signatureHash !== expectedHash) {
          const errorMsg = `Signature integrity FAILED for ${sig.entityType}:${sig.entityId} by ${sig.userName} at ${sig.timestampUtc.toISOString()}. Expected: ${expectedHash}, Got: ${sig.signatureHash}`;
          logger.error(`[${jobName}] ${errorMsg}`);
          errors.push(errorMsg);

          // Find tenant admin to notify
          const tenantUsers = await prisma.user.findMany({
            where: {
              tenantId: sig.tenantId,
              role: { in: ['TENANT_ADMIN', 'QUALITY_MANAGER'] },
              isActive: true,
            },
            select: { id: true },
          });

          for (const admin of tenantUsers) {
            await createNotification({
              tenantId: sig.tenantId,
              userId: admin.id,
              type: 'SYSTEM_ALERT',
              title: 'Signature Integrity Alert',
              message: `Electronic signature verification failed for ${sig.entityType} ${sig.entityId}. Immediate investigation required.`,
              entityType: sig.entityType,
              entityId: sig.entityId,
            });
          }
        }

        processedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Signature ${sig.id}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Fatal: ${msg}`);
    logger.error(`[${jobName}] Fatal error`, { error: err });
  }

  logger.info(`[${jobName}] Completed`, { processedCount, errorCount: errors.length });
  return { jobName, processedCount, errors, completedAt: new Date().toISOString() };
}

// ─── BullMQ Job Processors ──────────────────────────────────────────
// Each exported processor can be registered with a BullMQ Worker.
//
// Example usage:
//   import { Worker } from 'bullmq';
//   import { overdueActionsProcessor } from './jobs/scheduledTasks.js';
//   const worker = new Worker('overdue-actions', overdueActionsProcessor, { connection });

export async function overdueActionsProcessor(): Promise<JobResult> {
  return checkOverdueActions();
}

export async function expiringDocumentsProcessor(): Promise<JobResult> {
  return checkExpiringDocuments();
}

export async function expiringCertificationsProcessor(): Promise<JobResult> {
  return checkExpiringCertifications();
}

export async function signatureIntegrityProcessor(): Promise<JobResult> {
  return checkAuditSignatureIntegrity();
}
