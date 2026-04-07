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

export const listSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { tenantId: req.user.tenantId };

    if (req.query.category) where.category = req.query.category as string;
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.riskLevel) where.riskLevel = req.query.riskLevel as string;

    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search as string, mode: 'insensitive' } },
        { code: { contains: req.query.search as string, mode: 'insensitive' } },
        { contactEmail: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const db = prisma as any;
    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      db.supplier.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(suppliers, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getSupplierById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const supplier = await db.supplier.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        evaluations: {
          orderBy: { evaluationDate: 'desc' },
        },
      },
    });

    if (!supplier) {
      throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    }

    res.status(200).json({ data: supplier });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const {
      name, code, category, contactName, contactEmail, contactPhone,
      address, certifications, productsServices, riskLevel, notes,
    } = req.body;

    if (!name || !code) {
      throw new AppError('Name and code are required', 400, 'VALIDATION_ERROR');
    }

    const db = prisma as any;

    const existingCode = await db.supplier.findFirst({
      where: { tenantId: req.user.tenantId, code },
    });

    if (existingCode) {
      throw new AppError('Supplier code already exists', 409, 'DUPLICATE_CODE');
    }

    const supplier = await db.supplier.create({
      data: {
        tenantId: req.user.tenantId,
        name,
        code,
        category: category || null,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        address: address || null,
        certifications: certifications || [],
        productsServices: productsServices || [],
        riskLevel: riskLevel || 'MEDIUM',
        notes: notes || null,
        status: 'PENDING_APPROVAL',
        createdById: req.user.id,
      },
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'SUPPLIER',
      entityId: supplier.id,
      afterState: { name, code, category, status: 'PENDING_APPROVAL' },
      changedFields: ['name', 'code', 'category', 'status'],
    });

    res.status(201).json({ data: supplier });
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const db = prisma as any;

    const existing = await db.supplier.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    }

    const allowedFields = [
      'name', 'category', 'contactName', 'contactEmail', 'contactPhone',
      'address', 'certifications', 'productsServices', 'riskLevel', 'notes',
    ];

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const beforeState: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
        changedFields.push(field);
        beforeState[field] = existing[field];
      }
    }

    const supplier = await db.supplier.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'UPDATE' as any,
      entityType: 'SUPPLIER',
      entityId: id,
      beforeState,
      afterState: updateData,
      changedFields,
    });

    res.status(200).json({ data: supplier });
  } catch (error) {
    next(error);
  }
};

export const updateSupplierStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['APPROVED', 'CONDITIONAL', 'DISQUALIFIED', 'PENDING_APPROVAL'];
    if (!status || !validStatuses.includes(status)) {
      throw new AppError(
        `Status must be one of: ${validStatuses.join(', ')}`,
        400,
        'INVALID_STATUS',
      );
    }

    const db = prisma as any;

    const existing = await db.supplier.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {
      status,
      statusChangedAt: new Date(),
      statusChangedById: req.user.id,
    };

    if (reason) {
      updateData.statusChangeReason = reason;
    }

    if (status === 'APPROVED') {
      updateData.approvedAt = new Date();
      updateData.approvedById = req.user.id;
    }

    const supplier = await db.supplier.update({
      where: { id },
      data: updateData,
    });

    await createAuditEntry({
      ...auditParams(req),
      action: 'STATUS_CHANGE' as any,
      entityType: 'SUPPLIER',
      entityId: id,
      beforeState: { status: existing.status },
      afterState: { status, reason },
      changedFields: ['status', 'statusChangedAt', 'statusChangedById'],
    });

    res.status(200).json({ data: supplier });
  } catch (error) {
    next(error);
  }
};

export const addEvaluation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;
    const {
      evaluationDate, qualityScore, deliveryScore, costScore,
      communicationScore, overallScore, comments, period,
      nonConformanceCount, criteria,
    } = req.body;

    if (!evaluationDate) {
      throw new AppError('Evaluation date is required', 400, 'VALIDATION_ERROR');
    }

    const db = prisma as any;

    const existing = await db.supplier.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    }

    // Calculate overall score if individual scores provided and overall not given
    let calculatedOverall = overallScore;
    if (!calculatedOverall && qualityScore && deliveryScore) {
      const scores = [qualityScore, deliveryScore, costScore, communicationScore].filter(Boolean);
      calculatedOverall = Math.round(scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length);
    }

    const evaluation = await db.supplierEvaluation.create({
      data: {
        supplierId: id,
        tenantId: req.user.tenantId,
        evaluationDate: new Date(evaluationDate),
        qualityScore: qualityScore || null,
        deliveryScore: deliveryScore || null,
        costScore: costScore || null,
        communicationScore: communicationScore || null,
        overallScore: calculatedOverall || null,
        comments: comments || null,
        period: period || null,
        nonConformanceCount: nonConformanceCount || 0,
        criteria: criteria || null,
        evaluatedById: req.user.id,
      },
    });

    // Update supplier's latest evaluation score
    if (calculatedOverall) {
      await db.supplier.update({
        where: { id },
        data: {
          lastEvaluationScore: calculatedOverall,
          lastEvaluationDate: new Date(evaluationDate),
        },
      });
    }

    await createAuditEntry({
      ...auditParams(req),
      action: 'CREATE' as any,
      entityType: 'SUPPLIER_EVALUATION',
      entityId: evaluation.id,
      afterState: { supplierId: id, evaluationDate, overallScore: calculatedOverall },
      changedFields: ['evaluationDate', 'qualityScore', 'deliveryScore', 'overallScore'],
    });

    res.status(201).json({ data: evaluation });
  } catch (error) {
    next(error);
  }
};
