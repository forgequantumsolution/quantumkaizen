import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { createAuditEntry } from '../services/auditLog.service.js';
import { createNotification } from '../services/notification.service.js';
import { createSignature } from '../services/eSignature.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

const NC_STATUS_FLOW: Record<string, string[]> = {
  OPEN: ['UNDER_INVESTIGATION'],
  UNDER_INVESTIGATION: ['CONTAINMENT'],
  CONTAINMENT: ['ROOT_CAUSE_ANALYSIS'],
  ROOT_CAUSE_ANALYSIS: ['CAPA_DEFINITION'],
  CAPA_DEFINITION: ['IMPLEMENTATION'],
  IMPLEMENTATION: ['EFFECTIVENESS_CHECK'],
  EFFECTIVENESS_CHECK: ['CLOSED'],
};

const createNCSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'SUPPLIER', 'CUSTOMER', 'PROCESS', 'PRODUCT', 'SYSTEM']),
  severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']),
  department: z.string().optional(),
  assigneeId: z.string().uuid().optional(),
  source: z.string().optional(),
  detectedDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  affectedProduct: z.string().optional(),
  affectedProcess: z.string().optional(),
  quantity: z.number().optional(),
  site: z.string().optional(),
});

const updateNCSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'SUPPLIER', 'CUSTOMER', 'PROCESS', 'PRODUCT', 'SYSTEM']).optional(),
  severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']).optional(),
  department: z.string().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  source: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  affectedProduct: z.string().optional(),
  affectedProcess: z.string().optional(),
  quantity: z.number().optional(),
});

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

async function generateNCNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.nonConformance.count({
    where: {
      tenantId,
      ncNumber: { startsWith: `NC-${year}-` },
    },
  });
  const sequential = String(count + 1).padStart(4, '0');
  return `NC-${year}-${sequential}`;
}

export const listNonConformances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.status) where.status = req.query.status as string;
    if (req.query.severity) where.severity = req.query.severity as string;
    if (req.query.type) where.type = req.query.type as string;
    if (req.query.department) where.departmentAffected = req.query.department as string;
    if (req.query.assigneeId) where.assignedToId = req.query.assigneeId as string;

    if (req.query.dateFrom || req.query.dateTo) {
      where.createdAt = {
        ...(req.query.dateFrom ? { gte: new Date(req.query.dateFrom as string) } : {}),
        ...(req.query.dateTo ? { lte: new Date(req.query.dateTo as string) } : {}),
      };
    }

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { ncNumber: { contains: req.query.search as string, mode: 'insensitive' } },
        { description: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const [nonConformances, total] = await Promise.all([
      prisma.nonConformance.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          reportedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.nonConformance.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(nonConformances, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getNonConformanceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const nc = await prisma.nonConformance.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        reportedBy: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        capas: {
          select: { id: true, capaNumber: true, title: true, status: true, type: true },
        },
      },
    });

    if (!nc) {
      throw new AppError('Non-conformance not found', 404, 'NC_NOT_FOUND');
    }

    res.status(200).json({ data: nc });
  } catch (error) {
    next(error);
  }
};

export const createNonConformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const validation = createNCSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
    }

    const data = validation.data;
    const ncNumber = await generateNCNumber(req.user.tenantId);

    const nc = await prisma.nonConformance.create({
      data: {
        tenantId: req.user.tenantId,
        ncNumber,
        title: data.title,
        description: data.description,
        type: data.type as any,
        severity: data.severity as any,
        status: 'OPEN' as any,
        department: data.department || null,
        assigneeId: data.assigneeId || null,
        source: data.source || null,
        detectedDate: data.detectedDate ? new Date(data.detectedDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        affectedProduct: data.affectedProduct || null,
        affectedProcess: data.affectedProcess || null,
        quantity: data.quantity || null,
        site: data.site || null,
        reportedById: req.user.id,
      },
      include: {
        reportedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    // Notify assignee if assigned
    if (data.assigneeId) {
      await createNotification({
        tenantId: req.user.tenantId,
        userId: data.assigneeId,
        type: 'NC_ASSIGNED' as any,
        title: 'Non-Conformance Assigned',
        message: `Non-Conformance "${nc.title}" (${ncNumber}) has been assigned to you.`,
        entityType: 'NON_CONFORMANCE',
        entityId: nc.id,
      });
    }

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'NON_CONFORMANCE',
      entityId: nc.id,
      afterState: { ncNumber, title: data.title, type: data.type, severity: data.severity },
      changedFields: ['ncNumber', 'title', 'description', 'type', 'severity', 'status'],
    });

    res.status(201).json({ data: nc });
  } catch (error) {
    next(error);
  }
};

export const updateNonConformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const validation = updateNCSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
    }

    const existing = await prisma.nonConformance.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Non-conformance not found', 404, 'NC_NOT_FOUND');
    }

    if (existing.status === 'CLOSED') {
      throw new AppError('Cannot update a closed non-conformance', 400, 'NC_CLOSED');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [key, value] of Object.entries(validation.data)) {
      if (value !== undefined) {
        if (key === 'dueDate') {
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

    const nc = await prisma.nonConformance.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'NON_CONFORMANCE',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: nc });
  } catch (error) {
    next(error);
  }
};

export const updateNCStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { status, comments } = req.body;

    if (!status) {
      throw new AppError('Status is required', 400, 'STATUS_REQUIRED');
    }

    const existing = await prisma.nonConformance.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Non-conformance not found', 404, 'NC_NOT_FOUND');
    }

    const allowedTransitions = NC_STATUS_FLOW[existing.status];
    if (!allowedTransitions || !allowedTransitions.includes(status)) {
      throw new AppError(
        `Invalid status transition from ${existing.status} to ${status}`,
        400,
        'INVALID_TRANSITION',
      );
    }

    const nc = await prisma.nonConformance.update({
      where: { id },
      data: { status: status as any },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'NON_CONFORMANCE',
      entityId: id,
      beforeState: { status: existing.status },
      afterState: { status, comments },
      changedFields: ['status'],
    });

    res.status(200).json({ data: nc });
  } catch (error) {
    next(error);
  }
};

export const addContainment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { actions } = req.body;

    if (!actions || !Array.isArray(actions)) {
      throw new AppError('Containment actions array is required', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.nonConformance.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Non-conformance not found', 404, 'NC_NOT_FOUND');
    }

    const nc = await prisma.nonConformance.update({
      where: { id },
      data: { containmentActions: actions },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'NON_CONFORMANCE',
      entityId: id,
      beforeState: { containmentActions: existing.containmentActions },
      afterState: { containmentActions: actions, actionsCount: actions.length },
      changedFields: ['containmentActions'],
    });

    res.status(200).json({ data: nc });
  } catch (error) {
    next(error);
  }
};

export const addRootCause = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { fiveWhys, fishbone, rootCauseSummary } = req.body;

    if (!fiveWhys && !fishbone && !rootCauseSummary) {
      throw new AppError('At least one root cause analysis field is required', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.nonConformance.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Non-conformance not found', 404, 'NC_NOT_FOUND');
    }

    const rootCauseData: Record<string, unknown> = {};
    if (fiveWhys) rootCauseData.fiveWhys = fiveWhys;
    if (fishbone) rootCauseData.fishbone = fishbone;
    if (rootCauseSummary) rootCauseData.rootCauseSummary = rootCauseSummary;

    const nc = await prisma.nonConformance.update({
      where: { id },
      data: { rootCauseAnalysis: rootCauseData },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'NON_CONFORMANCE',
      entityId: id,
      beforeState: { rootCauseAnalysis: existing.rootCauseAnalysis },
      afterState: { rootCauseAnalysis: rootCauseData },
      changedFields: ['rootCauseAnalysis'],
    });

    res.status(200).json({ data: nc });
  } catch (error) {
    next(error);
  }
};

export const setDisposition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { disposition, comments } = req.body;

    const validDispositions = ['USE_AS_IS', 'REWORK', 'SCRAP', 'RETURN_TO_VENDOR'];
    if (!disposition || !validDispositions.includes(disposition)) {
      throw new AppError('Valid disposition is required: USE_AS_IS, REWORK, SCRAP, RETURN_TO_VENDOR', 400, 'INVALID_DISPOSITION');
    }

    const existing = await prisma.nonConformance.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Non-conformance not found', 404, 'NC_NOT_FOUND');
    }

    const nc = await prisma.nonConformance.update({
      where: { id },
      data: {
        disposition: disposition as any,
        dispositionComments: comments || null,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'NON_CONFORMANCE',
      entityId: id,
      beforeState: { disposition: existing.disposition },
      afterState: { disposition, comments },
      changedFields: ['disposition', 'dispositionComments'],
    });

    res.status(200).json({ data: nc });
  } catch (error) {
    next(error);
  }
};

export const closeNonConformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { password, meaning, closureComments, effectivenessVerified } = req.body;

    if (!password) {
      throw new AppError('Password is required for e-signature to close NC', 400, 'ESIGNATURE_REQUIRED');
    }

    const existing = await prisma.nonConformance.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Non-conformance not found', 404, 'NC_NOT_FOUND');
    }

    if (existing.status !== 'EFFECTIVENESS_CHECK') {
      throw new AppError('Non-conformance must be in EFFECTIVENESS_CHECK status to close', 400, 'INVALID_STATUS');
    }

    // Create e-signature
    await createSignature({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      password,
      meaning: meaning || 'NC Closure',
      entityType: 'NON_CONFORMANCE',
      entityId: id,
      entityVersion: '1',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    const nc = await prisma.nonConformance.update({
      where: { id },
      data: {
        status: 'CLOSED' as any,
        closedAt: new Date(),
        closedById: req.user.id,
        closureComments: closureComments || null,
        effectivenessVerified: effectivenessVerified || false,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CLOSE' as any,
      entityType: 'NON_CONFORMANCE',
      entityId: id,
      beforeState: { status: 'EFFECTIVENESS_CHECK' },
      afterState: { status: 'CLOSED', effectivenessVerified },
      changedFields: ['status', 'closedAt', 'closedById', 'closureComments', 'effectivenessVerified'],
    });

    res.status(200).json({ data: nc });
  } catch (error) {
    next(error);
  }
};

export const linkCAPA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { capaId } = req.body;

    if (!capaId) {
      throw new AppError('CAPA ID is required', 400, 'CAPA_ID_REQUIRED');
    }

    const existing = await prisma.nonConformance.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Non-conformance not found', 404, 'NC_NOT_FOUND');
    }

    const capa = await prisma.cAPA.findFirst({
      where: { id: capaId, tenantId: req.user.tenantId },
    });

    if (!capa) {
      throw new AppError('CAPA not found', 404, 'CAPA_NOT_FOUND');
    }

    await prisma.cAPA.update({
      where: { id: capaId },
      data: { nonConformanceId: id },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'LINK' as any,
      entityType: 'NON_CONFORMANCE',
      entityId: id,
      afterState: { linkedCapaId: capaId, capaNumber: capa.capaNumber },
      changedFields: ['linkedCapa'],
    });

    res.status(200).json({ data: { message: 'CAPA linked to non-conformance' } });
  } catch (error) {
    next(error);
  }
};
