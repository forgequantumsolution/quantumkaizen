import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { createAuditEntry } from '../services/auditLog.service.js';
import { AppError } from '../middleware/errorHandler.js';
import config from '../config/index.js';
import prisma from '../lib/prisma.js';

const registerSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum([
    'SUPER_ADMIN', 'TENANT_ADMIN', 'QUALITY_MANAGER', 'DEPARTMENT_HEAD',
    'DOCUMENT_CONTROLLER', 'AUDITOR', 'INSPECTOR', 'OPERATOR', 'VIEWER',
  ]),
  department: z.string().optional(),
  site: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  tenantCode: z.string().min(1, 'Tenant code is required'),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(req.user.role)) {
      throw new AppError('Only tenant admins can register new users', 403, 'FORBIDDEN');
    }

    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
    }

    const user = await authService.register({
      tenantId: req.user.tenantId,
      ...validation.data,
    });

    await createAuditEntry({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE' as any,
      entityType: 'USER',
      entityId: user.id,
      afterState: { email: user.email, role: user.role },
      changedFields: ['email', 'name', 'role', 'employeeId'],
      ipAddress: req.ip || '',
      sessionId: req.cookies?.sessionId || 'system',
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
    }

    const { email, password, tenantCode } = validation.data;
    const result = await authService.login(email, password, tenantCode);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    await createAuditEntry({
      tenantId: result.user.tenantId,
      userId: result.user.id,
      userName: result.user.name,
      userRole: result.user.role,
      action: 'LOGIN' as any,
      entityType: 'AUTH',
      entityId: result.user.id,
      ipAddress: req.ip || '',
      sessionId: req.cookies?.sessionId || 'system',
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(200).json({
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      throw new AppError('Refresh token is required', 401, 'MISSING_REFRESH_TOKEN');
    }

    const result = await authService.refreshToken(token);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({
      data: { accessToken: result.accessToken },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      path: '/',
    });

    if (req.user) {
      await createAuditEntry({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'LOGOUT' as any,
        entityType: 'AUTH',
        entityId: req.user.id,
        ipAddress: req.ip || '',
        sessionId: req.cookies?.sessionId || 'system',
        userAgent: req.headers['user-agent'] || '',
      });
    }

    res.status(200).json({ data: { message: 'Logged out successfully' } });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        tenantId: true,
        employeeId: true,
        email: true,
        name: true,
        role: true,
        department: true,
        site: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
};
