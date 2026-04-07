import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../services/auditLog.service.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

const COMPLAINT_STATUS_FLOW: Record<string, string[]> = {
  RECEIVED: ['UNDER_INVESTIGATION'],
  UNDER_INVESTIGATION: ['ROOT_CAUSE_IDENTIFIED'],
  ROOT_CAUSE_IDENTIFIED: ['RESOLUTION_PROPOSED'],
  RESOLUTION_PROPOSED: ['RESOLUTION_IMPLEMENTED'],
  RESOLUTION_IMPLEMENTED: ['CLOSED'],
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

async function generateComplaintNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const db = prisma as any;
  const count = await db.complaint.count({
    where: {
      tenantId,
      complaintNumber: { startsWith: `CMP-${year}-` },
    },
  });
  const sequential = String(count + 1).padStart(4, '0');
  return `CMP-${year}-${sequential}`;
}

export const listComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.status) where.status = req.query.status as string;
    if (req.query.severity) where.severity = req.query.severity as string;
    if (req.query.category) where.category = req.query.category as string;
    if (req.query.assigneeId) where.assigneeId = req.query.assigneeId as string;
    if (req.query.source) where.source = req.query.source as string;

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { complaintNumber: { contains: req.query.search as string, mode: 'insensitive' } },
        { customerName: { contains: req.query.search as string, mode: 'insensitive' } },
        { description: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const db = prisma as any;
    const [complaints, total] = await Promise.all([
      db.complaint.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      db.complaint.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(complaints, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getComplaintById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const complaint = await db.complaint.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!complaint) {
      throw new AppError('Complaint not found', 404, 'COMPLAINT_NOT_FOUND');
    }

    res.status(200).json({ data: complaint });
  } catch (error) {
    next(error);
  }
};

export const createComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      title, description, source, severity, category, customerName,
      customerContact, productBatch, affectedProduct, affectedProcess,
      receivedDate, assigneeId, department, dueDate,
    } = req.body;

    if (!title || !description) {
      throw new AppError('Title and description are required', 400, 'VALIDATION_ERROR');
    }

    const complaintNumber = await generateComplaintNumber(req.user.tenantId);
    const db = prisma as any;

    const complaint = await db.complaint.create({
      data: {
        tenantId: req.user.tenantId,
        complaintNumber,
        title,
        description,
        source: source || 'CUSTOMER',
        severity: severity || 'MINOR',
        category: category || null,
        customerName: customerName || null,
        customerContact: customerContact || null,
        productBatch: productBatch || null,
        affectedProduct: affectedProduct || null,
        affectedProcess: affectedProcess || null,
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        assigneeId: assigneeId || null,
        department: department || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'RECEIVED',
        reportedById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'COMPLAINT',
      entityId: complaint.id,
      afterState: { complaintNumber, title, source, severity, status: 'RECEIVED' },
      changedFields: ['complaintNumber', 'title', 'description', 'source', 'severity', 'status'],
    });

    res.status(201).json({ data: complaint });
  } catch (error) {
    next(error);
  }
};

export const updateComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const existing = await db.complaint.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Complaint not found', 404, 'COMPLAINT_NOT_FOUND');
    }

    if (existing.status === 'CLOSED') {
      throw new AppError('Cannot update a closed complaint', 400, 'COMPLAINT_CLOSED');
    }

    const allowedFields = [
      'title', 'description', 'source', 'severity', 'category', 'customerName',
      'customerContact', 'productBatch', 'affectedProduct', 'affectedProcess',
      'assigneeId', 'department', 'dueDate', 'rootCauseAnalysis',
      'investigationNotes',
    ];

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const beforeState: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'dueDate') {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
        changedFields.push(field);
        beforeState[field] = existing[field];
      }
    }

    const complaint = await db.complaint.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'COMPLAINT',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: complaint });
  } catch (error) {
    next(error);
  }
};

export const updateComplaintStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { status, comments } = req.body;

    if (!status) {
      throw new AppError('Status is required', 400, 'STATUS_REQUIRED');
    }

    const db = prisma as any;

    const existing = await db.complaint.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Complaint not found', 404, 'COMPLAINT_NOT_FOUND');
    }

    const allowedTransitions = COMPLAINT_STATUS_FLOW[existing.status];
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

    const complaint = await db.complaint.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'COMPLAINT',
      entityId: id,
      beforeState: { status: existing.status },
      afterState: { status, comments },
      changedFields: ['status'],
    });

    res.status(200).json({ data: complaint });
  } catch (error) {
    next(error);
  }
};

export const addResolution = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { resolution, correctiveActions, preventiveActions, customerResponse } = req.body;

    if (!resolution) {
      throw new AppError('Resolution description is required', 400, 'VALIDATION_ERROR');
    }

    const db = prisma as any;

    const existing = await db.complaint.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Complaint not found', 404, 'COMPLAINT_NOT_FOUND');
    }

    const complaint = await db.complaint.update({
      where: { id },
      data: {
        resolution,
        correctiveActions: correctiveActions || null,
        preventiveActions: preventiveActions || null,
        customerResponse: customerResponse || null,
        resolvedAt: new Date(),
        resolvedById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'COMPLAINT',
      entityId: id,
      beforeState: { resolution: existing.resolution },
      afterState: { resolution, correctiveActions, preventiveActions },
      changedFields: ['resolution', 'correctiveActions', 'preventiveActions', 'resolvedAt'],
    });

    res.status(200).json({ data: complaint });
  } catch (error) {
    next(error);
  }
};
