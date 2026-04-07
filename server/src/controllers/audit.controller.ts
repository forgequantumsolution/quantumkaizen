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

async function generateAuditNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const db = prisma as any;
  const count = await db.auditPlan.count({
    where: {
      tenantId,
      auditNumber: { startsWith: `AUD-${year}-` },
    },
  });
  const sequential = String(count + 1).padStart(4, '0');
  return `AUD-${year}-${sequential}`;
}

export const listAudits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.type) where.type = req.query.type as string;
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.year) {
      const year = parseInt(req.query.year as string, 10);
      where.scheduledDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }
    if (req.query.leadAuditorId) where.leadAuditorId = req.query.leadAuditorId as string;

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { auditNumber: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const db = prisma as any;
    const [audits, total] = await Promise.all([
      db.auditPlan.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      db.auditPlan.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(audits, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getAuditById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const audit = await db.auditPlan.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        findings: true,
      },
    });

    if (!audit) {
      throw new AppError('Audit not found', 404, 'AUDIT_NOT_FOUND');
    }

    res.status(200).json({ data: audit });
  } catch (error) {
    next(error);
  }
};

export const createAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      title, type, scope, objectives, department, scheduledDate,
      leadAuditorId, auditTeam, checklist, standard,
    } = req.body;

    if (!title || !type || !scheduledDate) {
      throw new AppError('Title, type, and scheduled date are required', 400, 'VALIDATION_ERROR');
    }

    const auditNumber = await generateAuditNumber(req.user.tenantId);
    const db = prisma as any;

    const audit = await db.auditPlan.create({
      data: {
        tenantId: req.user.tenantId,
        auditNumber,
        title,
        type,
        scope: scope || null,
        objectives: objectives || null,
        department: department || null,
        scheduledDate: new Date(scheduledDate),
        leadAuditorId: leadAuditorId || req.user.id,
        auditTeam: auditTeam || [],
        checklist: checklist || [],
        standard: standard || null,
        status: 'PLANNED',
        createdById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'AUDIT_PLAN',
      entityId: audit.id,
      afterState: { auditNumber, title, type, scheduledDate },
      changedFields: ['auditNumber', 'title', 'type', 'scheduledDate', 'status'],
    });

    res.status(201).json({ data: audit });
  } catch (error) {
    next(error);
  }
};

export const updateAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const existing = await db.auditPlan.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Audit not found', 404, 'AUDIT_NOT_FOUND');
    }

    if (existing.status === 'CLOSED') {
      throw new AppError('Cannot update a closed audit', 400, 'AUDIT_CLOSED');
    }

    const allowedFields = [
      'title', 'type', 'scope', 'objectives', 'department', 'scheduledDate',
      'leadAuditorId', 'auditTeam', 'checklist', 'standard',
    ];

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const beforeState: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'scheduledDate') {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
        changedFields.push(field);
        beforeState[field] = existing[field];
      }
    }

    const audit = await db.auditPlan.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'AUDIT_PLAN',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: audit });
  } catch (error) {
    next(error);
  }
};

export const addFinding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const {
      title, description, type, severity, clause, department,
      assigneeId, dueDate, evidence,
    } = req.body;

    if (!title || !description || !type) {
      throw new AppError('Title, description, and type are required', 400, 'VALIDATION_ERROR');
    }

    const db = prisma as any;

    const existing = await db.auditPlan.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Audit not found', 404, 'AUDIT_NOT_FOUND');
    }

    const finding = await db.auditFinding.create({
      data: {
        auditPlanId: id,
        tenantId: req.user.tenantId,
        title,
        description,
        type,
        severity: severity || 'MINOR',
        clause: clause || null,
        department: department || null,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        evidence: evidence || null,
        status: 'OPEN',
        createdById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'AUDIT_FINDING',
      entityId: finding.id,
      afterState: { auditPlanId: id, title, type, severity },
      changedFields: ['title', 'description', 'type', 'severity', 'status'],
    });

    res.status(201).json({ data: finding });
  } catch (error) {
    next(error);
  }
};

export const completeAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { summary, recommendations } = req.body;
    const db = prisma as any;

    const existing = await db.auditPlan.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Audit not found', 404, 'AUDIT_NOT_FOUND');
    }

    if (existing.status !== 'IN_PROGRESS' && existing.status !== 'PLANNED') {
      throw new AppError('Audit must be in PLANNED or IN_PROGRESS status to complete', 400, 'INVALID_STATUS');
    }

    const audit = await db.auditPlan.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedDate: new Date(),
        summary: summary || null,
        recommendations: recommendations || null,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'AUDIT_PLAN',
      entityId: id,
      beforeState: { status: existing.status },
      afterState: { status: 'COMPLETED', summary },
      changedFields: ['status', 'completedDate', 'summary', 'recommendations'],
    });

    res.status(200).json({ data: audit });
  } catch (error) {
    next(error);
  }
};

export const closeAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { closureComments } = req.body;
    const db = prisma as any;

    const existing = await db.auditPlan.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Audit not found', 404, 'AUDIT_NOT_FOUND');
    }

    if (existing.status !== 'COMPLETED') {
      throw new AppError('Audit must be COMPLETED before closing', 400, 'INVALID_STATUS');
    }

    const audit = await db.auditPlan.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: req.user.id,
        closureComments: closureComments || null,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'AUDIT_PLAN',
      entityId: id,
      beforeState: { status: 'COMPLETED' },
      afterState: { status: 'CLOSED', closureComments },
      changedFields: ['status', 'closedAt', 'closedById', 'closureComments'],
    });

    res.status(200).json({ data: audit });
  } catch (error) {
    next(error);
  }
};
