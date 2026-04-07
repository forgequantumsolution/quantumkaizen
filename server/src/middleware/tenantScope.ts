import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

export function tenantScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.tenantId) {
    next(new AppError('Tenant context required', 400, 'TENANT_REQUIRED'));
    return;
  }
  next();
}
