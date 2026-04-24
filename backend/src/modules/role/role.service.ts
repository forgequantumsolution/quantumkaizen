import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import type { CreateRoleInput, ListQuery, UpdateRoleInput } from './role.schema';

export const list = async ({ page, pageSize, search }: ListQuery) => {
  const where: Prisma.RoleWhereInput = search
    ? { name: { contains: search, mode: 'insensitive' } }
    : {};

  const [items, total] = await Promise.all([
    prisma.role.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.role.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

export const getById = async (id: string) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw NotFound('Role not found');
  return role;
};

export const create = (data: CreateRoleInput) => prisma.role.create({ data });

export const update = (id: string, data: UpdateRoleInput) =>
  prisma.role.update({ where: { id }, data });

export const remove = (id: string) => prisma.role.delete({ where: { id } });
