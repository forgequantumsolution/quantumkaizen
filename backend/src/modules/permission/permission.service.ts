import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListQuery } from './permission.schema';

export interface PermissionGroup {
  module: string;
  permissions: {
    id: string;
    key: string;
    action: string;
    description: string;
  }[];
}

export const list = async ({ page, pageSize, search, module: moduleFilter }: ListQuery) => {
  const where: Prisma.PermissionWhereInput = {};
  if (moduleFilter) where.module = moduleFilter;
  if (search) {
    where.OR = [
      { key: { contains: search, mode: 'insensitive' } },
      { module: { contains: search, mode: 'insensitive' } },
      { action: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.permission.findMany({
      where,
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.permission.count({ where }),
  ]);
  return { items, total, page, pageSize };
};

export const grouped = async (): Promise<PermissionGroup[]> => {
  const all = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });
  const map = new Map<string, PermissionGroup>();
  for (const p of all) {
    if (!map.has(p.module)) map.set(p.module, { module: p.module, permissions: [] });
    map.get(p.module)!.permissions.push({
      id: p.id,
      key: p.key,
      action: p.action,
      description: p.description,
    });
  }
  return [...map.values()];
};
