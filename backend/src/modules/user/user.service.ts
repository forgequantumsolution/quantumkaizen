import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';
import { Conflict, NotFound } from '../../lib/httpError';
import { invalidatePermissionCache } from '../../middleware/permissions';
import type {
  CreateUserInput,
  ListQuery,
  ResetPasswordInput,
  UpdateUserInput,
} from './user.schema';

const publicSelect = {
  id: true,
  email: true,
  name: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  phone: true,
  designation: true,
  isActive: true,
  joinDate: true,
  lastLoginAt: true,
  avatarUrl: true,
  locale: true,
  timezone: true,
  departmentId: true,
  roleId: true,
  siteId: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, code: true, name: true } },
  role: { select: { id: true, name: true } },
  site: { select: { id: true, code: true, name: true } },
  manager: { select: { id: true, name: true, email: true } },
} as const;

const computeName = (data: { name?: string; firstName?: string | null; lastName?: string | null }, fallback = 'Unnamed User') => {
  if (data.name && data.name.trim()) return data.name.trim();
  const first = data.firstName?.trim() ?? '';
  const last = data.lastName?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  return combined || fallback;
};

export const list = async ({ page, pageSize, search, departmentId, roleId, siteId, isActive }: ListQuery) => {
  const where: Prisma.UserWhereInput = {
    ...(departmentId && { departmentId }),
    ...(roleId && { roleId }),
    ...(siteId && { siteId }),
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: publicSelect,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

export const getById = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select: publicSelect });
  if (!user) throw NotFound('User not found');
  return user;
};

export const create = async (input: CreateUserInput) => {
  const conflictCheck: Prisma.UserWhereInput[] = [{ email: input.email }];
  if (input.employeeId) conflictCheck.push({ employeeId: input.employeeId });
  const existing = await prisma.user.findFirst({
    where: { OR: conflictCheck },
    select: { id: true, email: true, employeeId: true },
  });
  if (existing) {
    throw Conflict(
      existing.email === input.email
        ? 'Email already in use'
        : 'Employee ID already in use',
    );
  }

  const passwordHash = await hashPassword(input.password);
  const name = computeName(input);

  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      employeeId: input.employeeId ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      name,
      phone: input.phone ?? null,
      designation: input.designation ?? null,
      departmentId: input.departmentId ?? null,
      roleId: input.roleId ?? null,
      siteId: input.siteId ?? null,
      managerId: input.managerId ?? null,
      joinDate: input.joinDate ?? null,
      locale: input.locale,
      timezone: input.timezone,
      isActive: input.isActive ?? true,
    },
    select: publicSelect,
  });
};

export const update = async (id: string, input: UpdateUserInput) => {
  const current = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, employeeId: true, firstName: true, lastName: true, name: true },
  });
  if (!current) throw NotFound('User not found');

  if (input.email && input.email !== current.email) {
    const e = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (e && e.id !== id) throw Conflict('Email already in use');
  }
  if (input.employeeId && input.employeeId !== current.employeeId) {
    const e = await prisma.user.findUnique({
      where: { employeeId: input.employeeId },
      select: { id: true },
    });
    if (e && e.id !== id) throw Conflict('Employee ID already in use');
  }

  const merged = {
    name: input.name,
    firstName: input.firstName === undefined ? current.firstName : input.firstName,
    lastName: input.lastName === undefined ? current.lastName : input.lastName,
  };
  const recomputedName = computeName(merged, current.name);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      email: input.email,
      employeeId: input.employeeId,
      firstName: input.firstName,
      lastName: input.lastName,
      name: recomputedName,
      phone: input.phone,
      designation: input.designation,
      departmentId: input.departmentId,
      roleId: input.roleId,
      siteId: input.siteId,
      managerId: input.managerId,
      joinDate: input.joinDate,
      locale: input.locale,
      timezone: input.timezone,
      isActive: input.isActive,
    },
    select: publicSelect,
  });
  if (input.roleId !== undefined) invalidatePermissionCache(id);
  return updated;
};

export const resetPassword = async (id: string, { password }: ResetPasswordInput) => {
  await getById(id);
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
};

export const deactivate = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw NotFound('User not found');
  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: publicSelect,
  });
  invalidatePermissionCache(id);
  return updated;
};
