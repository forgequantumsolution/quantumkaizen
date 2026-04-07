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

export const listRequirements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.standard) where.standard = req.query.standard as string;
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.category) where.category = req.query.category as string;
    if (req.query.department) where.department = req.query.department as string;

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { clauseNumber: { contains: req.query.search as string, mode: 'insensitive' } },
        { description: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const db = prisma as any;
    const [requirements, total] = await Promise.all([
      db.complianceRequirement.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      db.complianceRequirement.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(requirements, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getRequirementById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const requirement = await db.complianceRequirement.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!requirement) {
      throw new AppError('Compliance requirement not found', 404, 'REQUIREMENT_NOT_FOUND');
    }

    res.status(200).json({ data: requirement });
  } catch (error) {
    next(error);
  }
};

export const createRequirement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      standard, clauseNumber, title, description, category,
      department, responsibleId, evidence, dueDate, notes,
    } = req.body;

    if (!standard || !clauseNumber || !title) {
      throw new AppError('Standard, clause number, and title are required', 400, 'VALIDATION_ERROR');
    }

    const db = prisma as any;

    const requirement = await db.complianceRequirement.create({
      data: {
        tenantId: req.user.tenantId,
        standard,
        clauseNumber,
        title,
        description: description || null,
        category: category || null,
        department: department || null,
        responsibleId: responsibleId || null,
        evidence: evidence || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        status: 'NOT_ASSESSED',
        createdById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'COMPLIANCE_REQUIREMENT',
      entityId: requirement.id,
      afterState: { standard, clauseNumber, title, status: 'NOT_ASSESSED' },
      changedFields: ['standard', 'clauseNumber', 'title', 'status'],
    });

    res.status(201).json({ data: requirement });
  } catch (error) {
    next(error);
  }
};

export const updateRequirement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const existing = await db.complianceRequirement.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Compliance requirement not found', 404, 'REQUIREMENT_NOT_FOUND');
    }

    const allowedFields = [
      'standard', 'clauseNumber', 'title', 'description', 'category',
      'department', 'responsibleId', 'evidence', 'dueDate', 'notes',
      'status', 'assessmentDate', 'assessmentNotes', 'gapDescription',
      'actionPlan',
    ];

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const beforeState: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'dueDate' || field === 'assessmentDate') {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
        changedFields.push(field);
        beforeState[field] = existing[field];
      }
    }

    // Track status changes with assessment date
    if (updateData.status && updateData.status !== existing.status) {
      updateData.lastAssessedAt = new Date();
      updateData.lastAssessedById = req.user.id;
      changedFields.push('lastAssessedAt', 'lastAssessedById');
    }

    const requirement = await db.complianceRequirement.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'COMPLIANCE_REQUIREMENT',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: requirement });
  } catch (error) {
    next(error);
  }
};

export const getComplianceSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const db = prisma as any;

    const requirements = await db.complianceRequirement.findMany({
      where: { tenantId: req.user.tenantId },
      select: { standard: true, status: true },
    });

    // Group by standard
    const standardMap: Record<string, Record<string, number>> = {};
    const overallCounts: Record<string, number> = {};

    for (const req of requirements) {
      if (!standardMap[req.standard]) {
        standardMap[req.standard] = {};
      }
      standardMap[req.standard][req.status] = (standardMap[req.standard][req.status] || 0) + 1;
      overallCounts[req.status] = (overallCounts[req.status] || 0) + 1;
    }

    const byStandard = Object.entries(standardMap).map(([standard, statuses]) => {
      const total = Object.values(statuses).reduce((sum, count) => sum + count, 0);
      const compliant = statuses['COMPLIANT'] || 0;
      const partiallyCompliant = statuses['PARTIALLY_COMPLIANT'] || 0;
      const nonCompliant = statuses['NON_COMPLIANT'] || 0;
      const notAssessed = statuses['NOT_ASSESSED'] || 0;

      return {
        standard,
        total,
        compliant,
        partiallyCompliant,
        nonCompliant,
        notAssessed,
        complianceRate: total > 0 ? Math.round((compliant / total) * 100) : 0,
      };
    });

    const totalReqs = requirements.length;
    const totalCompliant = overallCounts['COMPLIANT'] || 0;

    res.status(200).json({
      data: {
        overall: {
          total: totalReqs,
          ...overallCounts,
          complianceRate: totalReqs > 0 ? Math.round((totalCompliant / totalReqs) * 100) : 0,
        },
        byStandard,
      },
    });
  } catch (error) {
    next(error);
  }
};
