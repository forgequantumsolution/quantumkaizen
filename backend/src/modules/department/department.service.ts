import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import type {
  CreateDepartmentInput,
  ListQuery,
  UpdateDepartmentInput,
} from './department.schema';

export const list = async ({ page, pageSize, search }: ListQuery) => {
  const where: Prisma.DepartmentWhereInput = search
    ? { name: { contains: search, mode: 'insensitive' } }
    : {};

  const [items, total] = await Promise.all([
    prisma.department.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.department.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

export const getById = async (id: string) => {
  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) throw NotFound('Department not found');
  return dept;
};

export const create = (data: CreateDepartmentInput) =>
  prisma.department.create({ data });

export const update = (id: string, data: UpdateDepartmentInput) =>
  prisma.department.update({ where: { id }, data });

export const remove = (id: string) =>
  prisma.department.delete({ where: { id } });
