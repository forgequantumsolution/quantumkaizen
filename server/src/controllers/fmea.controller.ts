import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createAuditEntry } from '../services/auditLog.service.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

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

async function generateFMEANumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const db = prisma as any;
  const count = await db.fMEA.count({
    where: {
      tenantId,
      fmeaNumber: { startsWith: `FMEA-${year}-` },
    },
  });
  const sequential = String(count + 1).padStart(4, '0');
  return `FMEA-${year}-${sequential}`;
}

export const listFMEAs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.type) where.type = req.query.type as string;
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.department) where.department = req.query.department as string;

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { fmeaNumber: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const db = prisma as any;
    const [fmeas, total] = await Promise.all([
      db.fMEA.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      db.fMEA.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(fmeas, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getFMEAById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const fmea = await db.fMEA.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        failureModes: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!fmea) {
      throw new AppError('FMEA not found', 404, 'FMEA_NOT_FOUND');
    }

    res.status(200).json({ data: fmea });
  } catch (error) {
    next(error);
  }
};

export const createFMEA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      title, type, productProcess, department, scope, teamMembers,
    } = req.body;

    if (!title || !type) {
      throw new AppError('Title and type are required', 400, 'VALIDATION_ERROR');
    }

    const fmeaNumber = await generateFMEANumber(req.user.tenantId);
    const db = prisma as any;

    const fmea = await db.fMEA.create({
      data: {
        tenantId: req.user.tenantId,
        fmeaNumber,
        title,
        type,
        productProcess: productProcess || null,
        department: department || null,
        scope: scope || null,
        teamMembers: teamMembers || [],
        status: 'DRAFT',
        createdById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'FMEA',
      entityId: fmea.id,
      afterState: { fmeaNumber, title, type },
      changedFields: ['fmeaNumber', 'title', 'type', 'status'],
    });

    res.status(201).json({ data: fmea });
  } catch (error) {
    next(error);
  }
};

export const addFailureMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const {
      processStep, potentialFailureMode, potentialEffect, potentialCause,
      severity, occurrence, detection, currentControls,
      recommendedActions, responsibleId, targetDate,
    } = req.body;

    if (!potentialFailureMode || !severity || !occurrence || !detection) {
      throw new AppError('Failure mode, severity, occurrence, and detection ratings are required', 400, 'VALIDATION_ERROR');
    }

    if (severity < 1 || severity > 10 || occurrence < 1 || occurrence > 10 || detection < 1 || detection > 10) {
      throw new AppError('Severity, occurrence, and detection must be between 1 and 10', 400, 'VALIDATION_ERROR');
    }

    const db = prisma as any;

    const existing = await db.fMEA.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('FMEA not found', 404, 'FMEA_NOT_FOUND');
    }

    const rpn = severity * occurrence * detection;

    const failureMode = await db.fMEAFailureMode.create({
      data: {
        fmeaId: id,
        processStep: processStep || null,
        potentialFailureMode,
        potentialEffect: potentialEffect || null,
        potentialCause: potentialCause || null,
        severity,
        occurrence,
        detection,
        rpn,
        currentControls: currentControls || null,
        recommendedActions: recommendedActions || null,
        responsibleId: responsibleId || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        status: 'OPEN',
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'FMEA_FAILURE_MODE',
      entityId: failureMode.id,
      afterState: { fmeaId: id, potentialFailureMode, severity, occurrence, detection, rpn },
      changedFields: ['potentialFailureMode', 'severity', 'occurrence', 'detection', 'rpn'],
    });

    res.status(201).json({ data: failureMode });
  } catch (error) {
    next(error);
  }
};

export const updateFailureMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id, fmId } = req.params;
    const db = prisma as any;

    const existingFMEA = await db.fMEA.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existingFMEA) {
      throw new AppError('FMEA not found', 404, 'FMEA_NOT_FOUND');
    }

    const existingFM = await db.fMEAFailureMode.findFirst({
      where: { id: fmId, fmeaId: id },
    });

    if (!existingFM) {
      throw new AppError('Failure mode not found', 404, 'FAILURE_MODE_NOT_FOUND');
    }

    const allowedFields = [
      'processStep', 'potentialFailureMode', 'potentialEffect', 'potentialCause',
      'severity', 'occurrence', 'detection', 'currentControls',
      'recommendedActions', 'actionsTaken', 'responsibleId', 'targetDate',
      'completionDate', 'status',
    ];

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const beforeState: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'targetDate' || field === 'completionDate') {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
        changedFields.push(field);
        beforeState[field] = existingFM[field];
      }
    }

    // Recalculate RPN if any S/O/D rating changed
    const newSeverity = (updateData.severity as number) ?? existingFM.severity;
    const newOccurrence = (updateData.occurrence as number) ?? existingFM.occurrence;
    const newDetection = (updateData.detection as number) ?? existingFM.detection;

    if (updateData.severity !== undefined || updateData.occurrence !== undefined || updateData.detection !== undefined) {
      if (newSeverity < 1 || newSeverity > 10 || newOccurrence < 1 || newOccurrence > 10 || newDetection < 1 || newDetection > 10) {
        throw new AppError('Severity, occurrence, and detection must be between 1 and 10', 400, 'VALIDATION_ERROR');
      }
      updateData.rpn = newSeverity * newOccurrence * newDetection;
      changedFields.push('rpn');
      beforeState.rpn = existingFM.rpn;
    }

    const failureMode = await db.fMEAFailureMode.update({
      where: { id: fmId },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'FMEA_FAILURE_MODE',
      entityId: fmId,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: failureMode });
  } catch (error) {
    next(error);
  }
};
