import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import type { ListQuery, UpdateUserInput } from './user.schema';

const publicSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true } },
  role: { select: { id: true, name: true } },
} as const;

export const list = async ({ page, pageSize, search, departmentId, roleId }: ListQuery) => {
  const where: Prisma.UserWhereInput = {
    ...(departmentId && { departmentId }),
    ...(roleId && { roleId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: publicSelect,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
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

export const update = (id: string, data: UpdateUserInput) =>
  prisma.user.update({ where: { id }, data, select: publicSelect });

export const remove = (id: string) => prisma.user.delete({ where: { id } });
