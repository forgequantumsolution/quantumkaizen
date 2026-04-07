import { Request, Response, NextFunction } from 'express';
import { getAuditLog } from '../services/auditLog.service.js';
import { AppError } from '../middleware/errorHandler.js';

export const queryAuditLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const filters = {
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
      userId: req.query.userId as string | undefined,
      action: req.query.action as any,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const result = await getAuditLog(
      req.user.tenantId,
      filters,
      req.query as Record<string, unknown>,
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
