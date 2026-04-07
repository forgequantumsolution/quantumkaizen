import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../services/auditLog.service.js';
import { createSignature } from '../services/eSignature.service.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

const CAPA_STATUS_FLOW: Record<string, string[]> = {
  INITIATED: ['CONTAINMENT'],
  CONTAINMENT: ['ROOT_CAUSE_ANALYSIS'],
  ROOT_CAUSE_ANALYSIS: ['ACTION_DEFINITION'],
  ACTION_DEFINITION: ['IMPLEMENTATION'],
  IMPLEMENTATION: ['EFFECTIVENESS_VERIFICATION'],
  EFFECTIVENESS_VERIFICATION: ['CLOSED', 'REOPENED'],
  REOPENED: ['CONTAINMENT', 'ROOT_CAUSE_ANALYSIS'],
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

async function generateCAPANumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.cAPA.count({
    where: {
      tenantId,
      capaNumber: { startsWith: `CAPA-${year}-` },
    },
  });
  const sequential = String(count + 1).padStart(4, '0');
  return `CAPA-${year}-${sequential}`;
}

export const listCAPAs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.status) where.status = req.query.status as string;
    if (req.query.source) where.source = req.query.source as string;
    if (req.query.severity) where.severity = req.query.severity as string;
    if (req.query.ownerId) where.ownerId = req.query.ownerId as string;
    if (req.query.department) where.department = req.query.department as string;

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { capaNumber: { contains: req.query.search as string, mode: 'insensitive' } },
        { description: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const [capas, total] = await Promise.all([
      prisma.cAPA.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.cAPA.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(capas, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getCAPAById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const capa = await prisma.cAPA.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        actions: true,
        nonConformances: {
          select: { id: true, ncNumber: true, title: true, status: true },
        },
      },
    });

    if (!capa) {
      throw new AppError('CAPA not found', 404, 'CAPA_NOT_FOUND');
    }

    res.status(200).json({ data: capa });
  } catch (error) {
    next(error);
  }
};

export const createCAPA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      title, description, source, severity, department, site,
      productProcess, discoveryDate, dueDate, ownerId,
      effectivenessCriteria, monitoringPeriodDays, sourceRecordId, sourceRecordType,
    } = req.body;

    if (!title || !description || !source || !severity) {
      throw new AppError('Title, description, source, and severity are required', 400, 'VALIDATION_ERROR');
    }

    const capaNumber = await generateCAPANumber(req.user.tenantId);

    const capa = await prisma.cAPA.create({
      data: {
        tenantId: req.user.tenantId,
        capaNumber,
        title,
        description,
        source: source as any,
        severity: severity as any,
        status: 'INITIATED' as any,
        department: department || null,
        site: site || null,
        productProcess: productProcess || null,
        discoveryDate: discoveryDate ? new Date(discoveryDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        ownerId: ownerId || req.user.id,
        effectivenessCriteria: effectivenessCriteria || null,
        monitoringPeriodDays: monitoringPeriodDays || 90,
        sourceRecordId: sourceRecordId || null,
        sourceRecordType: sourceRecordType || null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'CAPA',
      entityId: capa.id,
      afterState: { capaNumber, title, source, severity },
      changedFields: ['capaNumber', 'title', 'description', 'source', 'severity', 'status'],
    });

    res.status(201).json({ data: capa });
  } catch (error) {
    next(error);
  }
};

export const updateCAPA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const existing = await prisma.cAPA.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('CAPA not found', 404, 'CAPA_NOT_FOUND');
    }

    if (existing.status === 'CLOSED') {
      throw new AppError('Cannot update a closed CAPA', 400, 'CAPA_CLOSED');
    }

    const allowedFields = [
      'title', 'description', 'severity', 'department', 'site',
      'productProcess', 'dueDate', 'ownerId', 'effectivenessCriteria',
      'monitoringPeriodDays', 'rootCauseAnalysis',
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
        beforeState[field] = (existing as any)[field];
      }
    }

    const capa = await prisma.cAPA.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'CAPA',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: capa });
  } catch (error) {
    next(error);
  }
};

export const updateCAPAStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { status, comments } = req.body;

    if (!status) {
      throw new AppError('Status is required', 400, 'STATUS_REQUIRED');
    }

    const existing = await prisma.cAPA.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('CAPA not found', 404, 'CAPA_NOT_FOUND');
    }

    const allowedTransitions = CAPA_STATUS_FLOW[existing.status];
    if (!allowedTransitions || !allowedTransitions.includes(status)) {
      throw new AppError(
        `Invalid status transition from ${existing.status} to ${status}`,
        400,
        'INVALID_TRANSITION',
      );
    }

    const capa = await prisma.cAPA.update({
      where: { id },
      data: { status: status as any },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'CAPA',
      entityId: id,
      beforeState: { status: existing.status },
      afterState: { status, comments },
      changedFields: ['status'],
    });

    res.status(200).json({ data: capa });
  } catch (error) {
    next(error);
  }
};

export const addCAPAAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { type, description, ownerId, dueDate } = req.body;

    if (!type || !description || !ownerId) {
      throw new AppError('Type, description, and ownerId are required', 400, 'VALIDATION_ERROR');
    }

    if (!['CORRECTIVE', 'PREVENTIVE'].includes(type)) {
      throw new AppError('Type must be CORRECTIVE or PREVENTIVE', 400, 'INVALID_TYPE');
    }

    const existing = await prisma.cAPA.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('CAPA not found', 404, 'CAPA_NOT_FOUND');
    }

    const action = await prisma.cAPAAction.create({
      data: {
        capaId: id,
        type: type as any,
        description,
        ownerId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'CAPA_ACTION',
      entityId: action.id,
      afterState: { capaId: id, type, description, ownerId },
      changedFields: ['type', 'description', 'ownerId', 'dueDate'],
    });

    res.status(201).json({ data: action });
  } catch (error) {
    next(error);
  }
};

export const updateCAPAActionStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id, actionId } = req.params;
    const { completionDate, evidencePath, evidenceDescription, verificationStatus } = req.body;

    const existing = await prisma.cAPA.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('CAPA not found', 404, 'CAPA_NOT_FOUND');
    }

    const actionExists = await prisma.cAPAAction.findFirst({
      where: { id: actionId, capaId: id },
    });

    if (!actionExists) {
      throw new AppError('CAPA Action not found', 404, 'ACTION_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (completionDate) updateData.completionDate = new Date(completionDate);
    if (evidencePath !== undefined) updateData.evidencePath = evidencePath;
    if (evidenceDescription !== undefined) updateData.evidenceDescription = evidenceDescription;
    if (verificationStatus !== undefined) {
      updateData.verificationStatus = verificationStatus;
      updateData.verifiedById = req.user.id;
      updateData.verifiedAt = new Date();
    }

    const action = await prisma.cAPAAction.update({
      where: { id: actionId },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'CAPA_ACTION',
      entityId: actionId,
      beforeState: {
        completionDate: actionExists.completionDate,
        verificationStatus: actionExists.verificationStatus,
      },
      afterState: updateData,
      changedFields: Object.keys(updateData),
    });

    res.status(200).json({ data: action });
  } catch (error) {
    next(error);
  }
};

export const recordEffectiveness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { effectivenessResult } = req.body;

    if (!effectivenessResult) {
      throw new AppError('Effectiveness result is required', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.cAPA.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('CAPA not found', 404, 'CAPA_NOT_FOUND');
    }

    if (existing.status !== 'EFFECTIVENESS_VERIFICATION') {
      throw new AppError('CAPA must be in EFFECTIVENESS_VERIFICATION status', 400, 'INVALID_STATUS');
    }

    const capa = await prisma.cAPA.update({
      where: { id },
      data: {
        effectivenessResult,
        effectivenessCheckDate: new Date(),
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'CAPA',
      entityId: id,
      beforeState: { effectivenessResult: existing.effectivenessResult },
      afterState: { effectivenessResult, effectivenessCheckDate: new Date().toISOString() },
      changedFields: ['effectivenessResult', 'effectivenessCheckDate'],
    });

    res.status(200).json({ data: capa });
  } catch (error) {
    next(error);
  }
};

export const closeCAPA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { password, meaning } = req.body;

    if (!password) {
      throw new AppError('Password is required for e-signature to close CAPA', 400, 'ESIGNATURE_REQUIRED');
    }

    const existing = await prisma.cAPA.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('CAPA not found', 404, 'CAPA_NOT_FOUND');
    }

    if (existing.status !== 'EFFECTIVENESS_VERIFICATION') {
      throw new AppError('CAPA must be in EFFECTIVENESS_VERIFICATION status to close', 400, 'INVALID_STATUS');
    }

    if (!existing.effectivenessResult) {
      throw new AppError('Effectiveness check must be recorded before closing', 400, 'EFFECTIVENESS_REQUIRED');
    }

    await createSignature({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      password,
      meaning: meaning || 'CAPA Closure',
      entityType: 'CAPA',
      entityId: id,
      entityVersion: '1',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    const capa = await prisma.cAPA.update({
      where: { id },
      data: {
        status: 'CLOSED' as any,
        closedAt: new Date(),
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'CAPA',
      entityId: id,
      beforeState: { status: 'EFFECTIVENESS_VERIFICATION' },
      afterState: { status: 'CLOSED' },
      changedFields: ['status', 'closedAt'],
    });

    res.status(200).json({ data: capa });
  } catch (error) {
    next(error);
  }
};
