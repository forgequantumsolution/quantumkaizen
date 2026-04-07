import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../services/auditLog.service.js';
import { createSignature } from '../services/eSignature.service.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

const CR_STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED'],
  MORE_INFO_REQUIRED: ['SUBMITTED'],
  APPROVED: ['IMPLEMENTATION'],
  IMPLEMENTATION: ['VERIFICATION'],
  VERIFICATION: ['CLOSED'],
  REJECTED: [],
};

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

async function generateCRNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const db = prisma as any;
  const count = await db.changeRequest.count({
    where: {
      tenantId,
      crNumber: { startsWith: `CR-${year}-` },
    },
  });
  const sequential = String(count + 1).padStart(4, '0');
  return `CR-${year}-${sequential}`;
}

export const listChangeRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.status) where.status = req.query.status as string;
    if (req.query.type) where.type = req.query.type as string;
    if (req.query.priority) where.priority = req.query.priority as string;
    if (req.query.department) where.department = req.query.department as string;
    if (req.query.requestedById) where.requestedById = req.query.requestedById as string;

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { crNumber: { contains: req.query.search as string, mode: 'insensitive' } },
        { description: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const db = prisma as any;
    const [requests, total] = await Promise.all([
      db.changeRequest.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      db.changeRequest.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(requests, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getChangeRequestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const cr = await db.changeRequest.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!cr) {
      throw new AppError('Change request not found', 404, 'CR_NOT_FOUND');
    }

    res.status(200).json({ data: cr });
  } catch (error) {
    next(error);
  }
};

export const createChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      title, description, type, priority, department, justification,
      riskAssessment, impactAssessment, proposedSolution, affectedDocuments,
      affectedProcesses, implementationPlan, targetDate,
    } = req.body;

    if (!title || !description || !type) {
      throw new AppError('Title, description, and type are required', 400, 'VALIDATION_ERROR');
    }

    const crNumber = await generateCRNumber(req.user.tenantId);
    const db = prisma as any;

    const cr = await db.changeRequest.create({
      data: {
        tenantId: req.user.tenantId,
        crNumber,
        title,
        description,
        type,
        priority: priority || 'MEDIUM',
        department: department || null,
        justification: justification || null,
        riskAssessment: riskAssessment || null,
        impactAssessment: impactAssessment || null,
        proposedSolution: proposedSolution || null,
        affectedDocuments: affectedDocuments || [],
        affectedProcesses: affectedProcesses || [],
        implementationPlan: implementationPlan || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        status: 'DRAFT',
        requestedById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'CHANGE_REQUEST',
      entityId: cr.id,
      afterState: { crNumber, title, type, priority: priority || 'MEDIUM', status: 'DRAFT' },
      changedFields: ['crNumber', 'title', 'description', 'type', 'priority', 'status'],
    });

    res.status(201).json({ data: cr });
  } catch (error) {
    next(error);
  }
};

export const updateChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const existing = await db.changeRequest.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Change request not found', 404, 'CR_NOT_FOUND');
    }

    if (existing.status === 'CLOSED' || existing.status === 'REJECTED') {
      throw new AppError('Cannot update a closed or rejected change request', 400, 'CR_LOCKED');
    }

    const allowedFields = [
      'title', 'description', 'type', 'priority', 'department', 'justification',
      'riskAssessment', 'impactAssessment', 'proposedSolution', 'affectedDocuments',
      'affectedProcesses', 'implementationPlan', 'targetDate',
    ];

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const beforeState: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'targetDate') {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
        changedFields.push(field);
        beforeState[field] = existing[field];
      }
    }

    const cr = await db.changeRequest.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'CHANGE_REQUEST',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: cr });
  } catch (error) {
    next(error);
  }
};

export const updateChangeRequestStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { status, comments } = req.body;

    if (!status) {
      throw new AppError('Status is required', 400, 'STATUS_REQUIRED');
    }

    const db = prisma as any;

    const existing = await db.changeRequest.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Change request not found', 404, 'CR_NOT_FOUND');
    }

    const allowedTransitions = CR_STATUS_FLOW[existing.status];
    if (!allowedTransitions || !allowedTransitions.includes(status)) {
      throw new AppError(
        `Invalid status transition from ${existing.status} to ${status}`,
        400,
        'INVALID_TRANSITION',
      );
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'CLOSED') {
      updateData.closedAt = new Date();
      updateData.closedById = req.user.id;
    }

    const cr = await db.changeRequest.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'CHANGE_REQUEST',
      entityId: id,
      beforeState: { status: existing.status },
      afterState: { status, comments },
      changedFields: ['status'],
    });

    res.status(200).json({ data: cr });
  } catch (error) {
    next(error);
  }
};

export const approveChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { password, meaning, comments } = req.body;

    if (!password) {
      throw new AppError('Password is required for e-signature', 400, 'ESIGNATURE_REQUIRED');
    }

    const db = prisma as any;

    const existing = await db.changeRequest.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Change request not found', 404, 'CR_NOT_FOUND');
    }

    if (existing.status !== 'UNDER_REVIEW') {
      throw new AppError('Change request must be UNDER_REVIEW to approve', 400, 'INVALID_STATUS');
    }

    await createSignature({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      password,
      meaning: meaning || 'Change Request Approval',
      entityType: 'CHANGE_REQUEST',
      entityId: id,
      entityVersion: '1',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    const cr = await db.changeRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: req.user.id,
        approvalComments: comments || null,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'APPROVAL_ACTION' as any,
      entityType: 'CHANGE_REQUEST',
      entityId: id,
      beforeState: { status: 'UNDER_REVIEW' },
      afterState: { status: 'APPROVED', comments },
      changedFields: ['status', 'approvedAt', 'approvedById'],
    });

    res.status(200).json({ data: cr });
  } catch (error) {
    next(error);
  }
};
