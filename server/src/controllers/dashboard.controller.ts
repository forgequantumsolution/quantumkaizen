import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const tenantId = req.user.tenantId;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      openNCs,
      openCAPAs,
      pendingApprovals,
      expiringDocuments,
      overdueActions,
      totalTrainingAssignments,
      completedTrainingAssignments,
    ] = await Promise.all([
      prisma.nonConformance.count({
        where: { tenantId, status: { not: 'CLOSED' } },
      }),

      prisma.cAPA.count({
        where: { tenantId, status: { notIn: ['CLOSED', 'VERIFIED'] } },
      }),

      prisma.approvalRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),

      prisma.document.count({
        where: {
          tenantId,
          status: 'PUBLISHED',
          reviewDate: { gte: now, lte: thirtyDaysFromNow },
        },
      }),

      prisma.nonConformance.count({
        where: {
          tenantId,
          status: { not: 'CLOSED' },
          dueDate: { lt: now },
        },
      }),

      prisma.trainingAssignment.count({ where: { tenantId } }).catch(() => 0),

      prisma.trainingAssignment.count({
        where: { tenantId, status: 'COMPLETED' },
      }).catch(() => 0),
    ]);

    const trainingCompliance = totalTrainingAssignments > 0
      ? Math.round((completedTrainingAssignments / totalTrainingAssignments) * 100 * 100) / 100
      : 100;

    res.status(200).json({
      data: {
        openNCs,
        openCAPAs,
        pendingApprovals,
        expiringDocuments,
        overdueActions,
        trainingCompliance,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getRecentActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const recentActivity = await prisma.auditLog.findMany({
      where: { tenantId: req.user.tenantId },
      take: 20,
      orderBy: { timestampUtc: 'desc' },
    });

    res.status(200).json({ data: recentActivity });
  } catch (error) {
    next(error);
  }
};

export const getNCTrends = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const tenantId = req.user.tenantId;
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const ncs = await prisma.nonConformance.findMany({
      where: {
        tenantId,
        createdAt: { gte: twelveMonthsAgo },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Initialize all 12 months
    const trends: Record<string, number> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      trends[key] = 0;
    }

    for (const nc of ncs) {
      const date = new Date(nc.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (trends[key] !== undefined) {
        trends[key]++;
      }
    }

    const result = Object.entries(trends).map(([month, count]) => ({ month, count }));

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getNCByType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const ncsByType = await prisma.nonConformance.groupBy({
      by: ['type'],
      where: { tenantId: req.user.tenantId },
      _count: { id: true },
    });

    const result = ncsByType.map((item) => ({
      type: item.type,
      count: item._count.id,
    }));

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getNCBySeverity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const ncsBySeverity = await prisma.nonConformance.groupBy({
      by: ['severity'],
      where: { tenantId: req.user.tenantId },
      _count: { id: true },
    });

    const result = ncsBySeverity.map((item) => ({
      severity: item.severity,
      count: item._count.id,
    }));

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
