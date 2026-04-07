import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';

interface JwtPayload {
  id: string;
  tenantId: string;
  role: string;
  email: string;
  name: string;
}

export function verifyToken(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.accessToken;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = {
      id: decoded.id,
      tenantId: decoded.tenantId,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}
