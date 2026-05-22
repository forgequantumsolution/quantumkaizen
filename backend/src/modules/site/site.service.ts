import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/httpError';
import type { CreateSiteInput, ListQuery, UpdateSiteInput } from './site.schema';

const baseSelect = {
  id: true,
  code: true,
  name: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, tickets: true } },
} as const;

export const list = async ({ page, pageSize, search, isActive }: ListQuery) => {
  const where: Prisma.SiteWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const [items, total] = await Promise.all([
    prisma.site.findMany({
      where,
      select: baseSelect,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.site.count({ where }),
  ]);
  return { items, total, page, pageSize };
};

export const getById = async (id: string) => {
  const site = await prisma.site.findUnique({ where: { id }, select: baseSelect });
  if (!site) throw NotFound('Site not found');
  return site;
};

export const create = async (data: CreateSiteInput) => {
  const exists = await prisma.site.findFirst({
    where: { OR: [{ code: data.code }, { name: data.name }] },
    select: { id: true },
  });
  if (exists) throw Conflict('Code or name already in use');
  return prisma.site.create({ data, select: baseSelect });
};

export const update = async (id: string, data: UpdateSiteInput) => {
  await getById(id);
  if (data.code || data.name) {
    const conflict = await prisma.site.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [
              data.code ? { code: data.code } : undefined,
              data.name ? { name: data.name } : undefined,
            ].filter(Boolean) as Prisma.SiteWhereInput[],
          },
        ],
      },
      select: { id: true },
    });
    if (conflict) throw Conflict('Code or name already in use');
  }
  return prisma.site.update({ where: { id }, data, select: baseSelect });
};

export const remove = async (id: string) => {
  const site = await prisma.site.findUnique({
    where: { id },
    select: { _count: { select: { users: true, tickets: true } } },
  });
  if (!site) throw NotFound('Site not found');
  if (site._count.users > 0)
    throw Conflict(`Cannot delete: ${site._count.users} user(s) still assigned`);
  if (site._count.tickets > 0)
    throw Conflict(`Cannot delete: ${site._count.tickets} ticket(s) still reference this site`);
  return prisma.site.delete({ where: { id } });
};
