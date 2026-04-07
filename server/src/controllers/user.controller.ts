import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { createAuditEntry } from '../services/auditLog.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

const createUserSchema = z.object({
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

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum([
    'SUPER_ADMIN', 'TENANT_ADMIN', 'QUALITY_MANAGER', 'DEPARTMENT_HEAD',
    'DOCUMENT_CONTROLLER', 'AUDITOR', 'INSPECTOR', 'OPERATOR', 'VIEWER',
  ]).optional(),
  department: z.string().optional(),
  site: z.string().optional(),
  employeeId: z.string().optional(),
  password: z.string().min(8).optional(),
});

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const pagination = parsePagination(req.query as Record<string, unknown>);

    const where: Record<string, unknown> = {
      tenantId: req.user.tenantId,
    };

    if (req.query.role) where.role = req.query.role as string;
    if (req.query.department) where.department = req.query.department as string;
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search as string, mode: 'insensitive' } },
        { email: { contains: req.query.search as string, mode: 'insensitive' } },
        { employeeId: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
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
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(users, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, tenantId: req.user.tenantId },
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

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
    }

    const { email, password, name, role, department, site, employeeId } = validation.data;

    const existingUser = await prisma.user.findFirst({
      where: { email, tenantId: req.user.tenantId },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        tenantId: req.user.tenantId,
        employeeId,
        email,
        name,
        passwordHash,
        role: role as any,
        department,
        site,
        isActive: true,
      },
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
      },
    });

    await createAuditEntry({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE' as any,
      entityType: 'USER',
      entityId: user.id,
      afterState: { email, role, name },
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

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
    }

    const existing = await prisma.user.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const [key, value] of Object.entries(validation.data)) {
      if (value !== undefined) {
        if (key === 'password') {
          updateData.passwordHash = await bcrypt.hash(value as string, 12);
          changedFields.push('passwordHash');
        } else {
          updateData[key] = value;
          changedFields.push(key);
        }
      }
    }

    const beforeState: Record<string, unknown> = {};
    for (const field of changedFields) {
      beforeState[field] = (existing as any)[field];
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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
      },
    });

    await createAuditEntry({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE' as any,
      entityType: 'USER',
      entityId: user.id,
      beforeState,
      afterState: updateData,
      changedFields,
      ipAddress: req.ip || '',
      sessionId: req.cookies?.sessionId || 'system',
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new AppError('isActive must be a boolean', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.user.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!existing) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (existing.id === req.user.id) {
      throw new AppError('Cannot change your own active status', 400, 'SELF_STATUS_CHANGE');
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    // If deactivating, remove all refresh tokens
    if (!isActive) {
      await prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    await createAuditEntry({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: isActive ? ('ACTIVATE' as any) : ('DEACTIVATE' as any),
      entityType: 'USER',
      entityId: user.id,
      beforeState: { isActive: existing.isActive },
      afterState: { isActive },
      changedFields: ['isActive'],
      ipAddress: req.ip || '',
      sessionId: req.cookies?.sessionId || 'system',
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
};
