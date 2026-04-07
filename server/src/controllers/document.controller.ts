import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { createAuditEntry } from '../services/auditLog.service.js';
import { createNotification } from '../services/notification.service.js';
import { createSignature } from '../services/eSignature.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

const LEVEL_PREFIXES: Record<string, string> = {
  LEVEL_1: 'QM',
  LEVEL_2: 'SOP',
  LEVEL_3: 'WI',
  LEVEL_4: 'FRM',
};

const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  level: z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4']),
  category: z.string().min(1, 'Category is required'),
  department: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  effectiveDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  department: z.string().optional(),
  effectiveDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  changeDescription: z.string().optional(),
});

async function generateDocumentNumber(tenantId: string, level: string, category: string): Promise<string> {
  const prefix = LEVEL_PREFIXES[level] || 'DOC';
  const categoryCode = category.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 5);

  const count = await prisma.document.count({
    where: { tenantId, level, category },
  });

  const sequential = String(count + 1).padStart(3, '0');
  return `${prefix}-${categoryCode}-${sequential}`;
}

function auditParams(req: Request) {
  return {
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    ipAddress: req.ip || '',
    sessionId: req.cookies?.sessionId || 'system',
    userAgent: req.headers['user-agent'] || '',
  };
}

export const listDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.status) where.status = req.query.status as string;
    if (req.query.level) where.level = req.query.level as string;
    if (req.query.department) where.department = req.query.department as string;
    if (req.query.category) where.category = req.query.category as string;

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { documentNumber: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.document.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(documents, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getDocumentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const document = await prisma.document.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        },
        acknowledgements: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { acknowledgedAt: 'desc' },
        },
      },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    res.status(200).json({ data: document });
  } catch (error) {
    next(error);
  }
};

export const createDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const validation = createDocumentSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
    }

    const { title, level, category, department, description, content, tags, effectiveDate, reviewDate } = validation.data;
    const documentNumber = await generateDocumentNumber(req.user.tenantId, level, category);

    const document = await prisma.document.create({
      data: {
        tenantId: req.user.tenantId,
        documentNumber,
        title,
        level,
        category,
        department: department || null,
        description: description || null,
        content: content || null,
        tags: tags || [],
        status: 'DRAFT',
        currentVersion: '1.0',
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        ownerId: req.user.id,
      },
    });

    // Create initial version record
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: '1.0',
        content: content || '',
        changeDescription: 'Initial version',
        createdById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'DOCUMENT',
      entityId: document.id,
      afterState: { documentNumber, title, level, category },
      changedFields: ['documentNumber', 'title', 'level', 'category', 'content'],
    });

    res.status(201).json({ data: document });
  } catch (error) {
    next(error);
  }
};

export const updateDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const validation = updateDocumentSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
    }

    const existing = await prisma.document.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (!['DRAFT', 'UNDER_REVISION'].includes(existing.status)) {
      throw new AppError('Document can only be edited in DRAFT or UNDER_REVISION status', 400, 'INVALID_STATUS');
    }

    const { changeDescription, ...updateFields } = validation.data;
    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [key, value] of Object.entries(updateFields)) {
      if (value !== undefined) {
        if (key === 'effectiveDate' || key === 'reviewDate') {
          updateData[key] = new Date(value as string);
        } else {
          updateData[key] = value;
        }
        changedFields.push(key);
      }
    }

    const beforeState: Record<string, unknown> = {};
    for (const field of changedFields) {
      beforeState[field] = (existing as any)[field];
    }

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    // Create new version entry if content changed
    if (updateFields.content !== undefined) {
      await prisma.documentVersion.create({
        data: {
          documentId: id,
          versionNumber: document.currentVersion,
          content: updateFields.content,
          changeDescription: changeDescription || 'Content updated',
          createdById: req.user.id,
        },
      });
    }

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'DOCUMENT',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: document });
  } catch (error) {
    next(error);
  }
};

export const submitForReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { reviewerIds, workflowId } = req.body;

    const document = await prisma.document.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (document.status !== 'DRAFT') {
      throw new AppError('Only DRAFT documents can be submitted for review', 400, 'INVALID_STATUS');
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { status: 'UNDER_REVIEW' },
    });

    // Create approval request if workflow specified
    if (workflowId) {
      const { initiateApproval } = await import('../services/approval.service.js');
      await initiateApproval(req.user.tenantId, workflowId, 'DOCUMENT', id, req.user.id);
    }

    // Notify reviewers
    if (reviewerIds && Array.isArray(reviewerIds)) {
      for (const reviewerId of reviewerIds) {
        await createNotification({
          tenantId: req.user.tenantId,
          userId: reviewerId,
          type: 'DOCUMENT_REVIEW_REQUESTED' as any,
          title: 'Document Review Requested',
          message: `Document "${document.title}" (${document.documentNumber}) requires your review.`,
          entityType: 'DOCUMENT',
          entityId: id,
        });
      }
    }

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'DOCUMENT',
      entityId: id,
      beforeState: { status: 'DRAFT' },
      afterState: { status: 'UNDER_REVIEW' },
      changedFields: ['status'],
    });

    res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const approveDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { password, meaning, comments } = req.body;

    if (!password) {
      throw new AppError('Password is required for e-signature', 400, 'ESIGNATURE_REQUIRED');
    }

    const document = await prisma.document.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (!['UNDER_REVIEW', 'PENDING_APPROVAL'].includes(document.status)) {
      throw new AppError('Document is not in a reviewable state', 400, 'INVALID_STATUS');
    }

    // Create e-signature
    await createSignature({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      password,
      meaning: meaning || 'Document Approval',
      entityType: 'DOCUMENT',
      entityId: id,
      entityVersion: document.currentVersion,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    // Check pending approval requests
    const pendingApprovals = await prisma.approvalRequest.count({
      where: {
        entityType: 'DOCUMENT',
        entityId: id,
        status: 'PENDING',
      },
    });

    let newStatus = document.status;
    if (document.status === 'UNDER_REVIEW') {
      newStatus = 'PENDING_APPROVAL';
    }
    if (pendingApprovals === 0) {
      newStatus = 'PUBLISHED';
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === 'PUBLISHED' ? { effectiveDate: new Date() } : {}),
      },
    });

    // Notify document owner
    if (newStatus === 'PUBLISHED') {
      await createNotification({
        tenantId: req.user.tenantId,
        userId: document.ownerId,
        type: 'DOCUMENT_APPROVED' as any,
        title: 'Document Published',
        message: `Document "${document.title}" (${document.documentNumber}) has been published.`,
        entityType: 'DOCUMENT',
        entityId: id,
      });
    }

    await createAuditEntry({
      ...auditParams(req),
      action: 'APPROVE' as any,
      entityType: 'DOCUMENT',
      entityId: id,
      beforeState: { status: document.status },
      afterState: { status: newStatus, comments },
      changedFields: ['status'],
    });

    res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const rejectDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError('Rejection reason is required', 400, 'REASON_REQUIRED');
    }

    const document = await prisma.document.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (!['UNDER_REVIEW', 'PENDING_APPROVAL'].includes(document.status)) {
      throw new AppError('Document is not in a reviewable state', 400, 'INVALID_STATUS');
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { status: 'DRAFT' },
    });

    await createNotification({
      tenantId: req.user.tenantId,
      userId: document.ownerId,
      type: 'DOCUMENT_REJECTED' as any,
      title: 'Document Rejected',
      message: `Document "${document.title}" (${document.documentNumber}) has been rejected. Reason: ${reason}`,
      entityType: 'DOCUMENT',
      entityId: id,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'REJECT' as any,
      entityType: 'DOCUMENT',
      entityId: id,
      beforeState: { status: document.status },
      afterState: { status: 'DRAFT', reason },
      changedFields: ['status'],
    });

    res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const reviseDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { changeDescription } = req.body;

    const document = await prisma.document.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (document.status !== 'PUBLISHED') {
      throw new AppError('Only PUBLISHED documents can be revised', 400, 'INVALID_STATUS');
    }

    const versionParts = document.currentVersion.split('.');
    const major = parseInt(versionParts[0], 10);
    const minor = parseInt(versionParts[1] || '0', 10);
    const newVersion = `${major}.${minor + 1}`;

    const updated = await prisma.document.update({
      where: { id },
      data: {
        status: 'UNDER_REVISION',
        currentVersion: newVersion,
      },
    });

    await prisma.documentVersion.create({
      data: {
        documentId: id,
        versionNumber: newVersion,
        content: document.content || '',
        changeDescription: changeDescription || 'New revision started',
        createdById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'DOCUMENT',
      entityId: id,
      beforeState: { status: 'PUBLISHED', version: document.currentVersion },
      afterState: { status: 'UNDER_REVISION', version: newVersion },
      changedFields: ['status', 'currentVersion'],
    });

    res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const obsoleteDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { reason } = req.body;

    const document = await prisma.document.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (document.status === 'OBSOLETE') {
      throw new AppError('Document is already obsolete', 400, 'ALREADY_OBSOLETE');
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { status: 'OBSOLETE' },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'DOCUMENT',
      entityId: id,
      beforeState: { status: document.status },
      afterState: { status: 'OBSOLETE', reason: reason || 'Marked as obsolete' },
      changedFields: ['status'],
    });

    res.status(200).json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const acknowledgeDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const document = await prisma.document.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (document.status !== 'PUBLISHED') {
      throw new AppError('Only PUBLISHED documents can be acknowledged', 400, 'INVALID_STATUS');
    }

    const existingAck = await prisma.documentAcknowledgement.findFirst({
      where: {
        documentId: id,
        userId: req.user.id,
        version: document.currentVersion,
      },
    });

    if (existingAck) {
      throw new AppError('You have already acknowledged this version', 400, 'ALREADY_ACKNOWLEDGED');
    }

    const acknowledgement = await prisma.documentAcknowledgement.create({
      data: {
        documentId: id,
        userId: req.user.id,
        version: document.currentVersion,
        acknowledgedAt: new Date(),
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'ACKNOWLEDGE' as any,
      entityType: 'DOCUMENT',
      entityId: id,
      afterState: { version: document.currentVersion },
      changedFields: [],
    });

    res.status(200).json({ data: acknowledgement });
  } catch (error) {
    next(error);
  }
};

export const listDocumentVersions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const document = await prisma.document.findFirst({
      where: { id, tenantId: req.user.tenantId },
      select: { id: true },
    });

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ data: versions });
  } catch (error) {
    next(error);
  }
};
