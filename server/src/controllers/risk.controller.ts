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

function calculateRiskLevel(score: number): string {
  if (score >= 20) return 'CRITICAL';
  if (score >= 12) return 'HIGH';
  if (score >= 6) return 'MEDIUM';
  return 'LOW';
}

async function generateRiskNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.riskRegister.count({
    where: {
      tenantId,
      riskNumber: { startsWith: `RSK-${year}-` },
    },
  });
  const sequential = String(count + 1).padStart(4, '0');
  return `RSK-${year}-${sequential}`;
}

export const listRisks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.riskLevel) where.riskLevel = req.query.riskLevel as string;
    if (req.query.department) where.department = req.query.department as string;
    if (req.query.category) where.category = req.query.category as string;
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.ownerId) where.ownerId = req.query.ownerId as string;

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { riskNumber: { contains: req.query.search as string, mode: 'insensitive' } },
        { description: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const [risks, total] = await Promise.all([
      prisma.riskRegister.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.riskRegister.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(risks, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getRiskById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const risk = await prisma.riskRegister.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!risk) {
      throw new AppError('Risk not found', 404, 'RISK_NOT_FOUND');
    }

    res.status(200).json({ data: risk });
  } catch (error) {
    next(error);
  }
};

export const createRisk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      title, description, category, department, likelihood, consequence,
      ownerId, reviewDate, controlMeasures,
    } = req.body;

    if (!title || !description || !likelihood || !consequence) {
      throw new AppError('Title, description, likelihood, and consequence are required', 400, 'VALIDATION_ERROR');
    }

    if (likelihood < 1 || likelihood > 5 || consequence < 1 || consequence > 5) {
      throw new AppError('Likelihood and consequence must be between 1 and 5', 400, 'VALIDATION_ERROR');
    }

    const riskNumber = await generateRiskNumber(req.user.tenantId);
    const riskScore = likelihood * consequence;
    const riskLevel = calculateRiskLevel(riskScore);

    const risk = await prisma.riskRegister.create({
      data: {
        tenantId: req.user.tenantId,
        riskNumber,
        title,
        description,
        category: category || null,
        department: department || null,
        likelihood,
        consequence,
        riskScore,
        riskLevel: riskLevel as any,
        controlMeasures: controlMeasures || null,
        ownerId: ownerId || req.user.id,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        status: 'ACTIVE',
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'RISK',
      entityId: risk.id,
      afterState: { riskNumber, title, riskScore, riskLevel },
      changedFields: ['riskNumber', 'title', 'description', 'likelihood', 'consequence', 'riskScore', 'riskLevel'],
    });

    res.status(201).json({ data: risk });
  } catch (error) {
    next(error);
  }
};

export const updateRisk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const existing = await prisma.riskRegister.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Risk not found', 404, 'RISK_NOT_FOUND');
    }

    const allowedFields = [
      'title', 'description', 'category', 'department', 'likelihood',
      'consequence', 'ownerId', 'reviewDate', 'status',
    ];

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const beforeState: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'reviewDate') {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
        changedFields.push(field);
        beforeState[field] = (existing as any)[field];
      }
    }

    // Recalculate risk score if likelihood or consequence changed
    const newLikelihood = (updateData.likelihood as number) || existing.likelihood;
    const newConsequence = (updateData.consequence as number) || existing.consequence;

    if (updateData.likelihood !== undefined || updateData.consequence !== undefined) {
      if (newLikelihood < 1 || newLikelihood > 5 || newConsequence < 1 || newConsequence > 5) {
        throw new AppError('Likelihood and consequence must be between 1 and 5', 400, 'VALIDATION_ERROR');
      }
      updateData.riskScore = newLikelihood * newConsequence;
      updateData.riskLevel = calculateRiskLevel(updateData.riskScore as number);
      changedFields.push('riskScore', 'riskLevel');
      beforeState.riskScore = existing.riskScore;
      beforeState.riskLevel = existing.riskLevel;
    }

    const risk = await prisma.riskRegister.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'RISK',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: risk });
  } catch (error) {
    next(error);
  }
};

export const addControlMeasure = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { control } = req.body;

    if (!control || !control.description) {
      throw new AppError('Control measure description is required', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.riskRegister.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Risk not found', 404, 'RISK_NOT_FOUND');
    }

    const existingControls = (existing.controlMeasures as any[]) || [];
    const newControl = {
      id: `ctrl-${Date.now()}`,
      description: control.description,
      type: control.type || 'MITIGATE',
      status: control.status || 'PLANNED',
      responsibleId: control.responsibleId || null,
      implementedDate: control.implementedDate || null,
      createdAt: new Date().toISOString(),
    };

    const updatedControls = [...existingControls, newControl];

    const risk = await prisma.riskRegister.update({
      where: { id },
      data: { controlMeasures: updatedControls },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'RISK',
      entityId: id,
      beforeState: { controlMeasuresCount: existingControls.length },
      afterState: { controlMeasuresCount: updatedControls.length, addedControl: newControl },
      changedFields: ['controlMeasures'],
    });

    res.status(201).json({ data: risk });
  } catch (error) {
    next(error);
  }
};

export const updateResidualRisk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { residualLikelihood, residualConsequence } = req.body;

    if (!residualLikelihood || !residualConsequence) {
      throw new AppError('Residual likelihood and consequence are required', 400, 'VALIDATION_ERROR');
    }

    if (residualLikelihood < 1 || residualLikelihood > 5 || residualConsequence < 1 || residualConsequence > 5) {
      throw new AppError('Residual likelihood and consequence must be between 1 and 5', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.riskRegister.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Risk not found', 404, 'RISK_NOT_FOUND');
    }

    const residualScore = residualLikelihood * residualConsequence;
    const residualLevel = calculateRiskLevel(residualScore);

    const risk = await prisma.riskRegister.update({
      where: { id },
      data: {
        residualLikelihood,
        residualConsequence,
        residualScore,
        residualLevel: residualLevel as any,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'RISK',
      entityId: id,
      beforeState: {
        residualLikelihood: existing.residualLikelihood,
        residualConsequence: existing.residualConsequence,
        residualScore: existing.residualScore,
        residualLevel: existing.residualLevel,
      },
      afterState: { residualLikelihood, residualConsequence, residualScore, residualLevel },
      changedFields: ['residualLikelihood', 'residualConsequence', 'residualScore', 'residualLevel'],
    });

    res.status(200).json({ data: risk });
  } catch (error) {
    next(error);
  }
};

export const getHeatmap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const risks = await prisma.riskRegister.findMany({
      where: { tenantId: req.user.tenantId, status: 'ACTIVE' },
      select: { likelihood: true, consequence: true, id: true, title: true, riskLevel: true },
    });

    // Build 5x5 heatmap matrix
    const heatmap: { likelihood: number; consequence: number; count: number; risks: { id: string; title: string }[] }[] = [];

    for (let l = 1; l <= 5; l++) {
      for (let c = 1; c <= 5; c++) {
        const cellRisks = risks.filter((r) => r.likelihood === l && r.consequence === c);
        heatmap.push({
          likelihood: l,
          consequence: c,
          count: cellRisks.length,
          risks: cellRisks.map((r) => ({ id: r.id, title: r.title })),
        });
      }
    }

    const summary = {
      total: risks.length,
      byLevel: {
        CRITICAL: risks.filter((r) => r.riskLevel === 'CRITICAL').length,
        HIGH: risks.filter((r) => r.riskLevel === 'HIGH').length,
        MEDIUM: risks.filter((r) => r.riskLevel === 'MEDIUM').length,
        LOW: risks.filter((r) => r.riskLevel === 'LOW').length,
      },
    };

    res.status(200).json({ data: { heatmap, summary } });
  } catch (error) {
    next(error);
  }
};
