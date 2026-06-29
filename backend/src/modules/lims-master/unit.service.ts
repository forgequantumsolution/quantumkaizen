/** LIMS Master Data — Units of Measure (referenced by spec parameters and tests). */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { ListUnitQuery, UnitUpsertInput } from './unit.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.unitOfMeasure.count();
  return `UOM-${String(count + 1).padStart(3, '0')}`;
};

const serialize = (u: Prisma.UnitOfMeasureGetPayload<object>) => ({
  id: u.id,
  code: u.code,
  name: u.name,
  symbol: u.symbol,
  kind: u.kind,
  is_active: u.isActive,
  created_at: u.createdAt,
  updated_at: u.updatedAt,
});

export const listUnits = async (q: ListUnitQuery) => {
  const where: Prisma.UnitOfMeasureWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { symbol: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.unitOfMeasure.count({ where }),
    prisma.unitOfMeasure.findMany({ where, orderBy: { code: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map(serialize), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string) => {
  const u = await prisma.unitOfMeasure.findFirst({ where: { id, isDeleted: false } });
  if (!u) throw NotFound('Unit of measure not found');
  return u;
};

export const getUnit = async (id: string) => serialize(await getRow(id));

export const createUnit = async (input: UnitUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.unitOfMeasure.create({
    data: {
      code,
      name: input.name,
      symbol: input.symbol ?? null,
      kind: input.kind ?? null,
      isActive: input.is_active ?? true,
    },
  });
  await writeTrail({ entityType: 'UnitOfMeasure', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return serialize(created);
};

export const updateUnit = async (id: string, input: UnitUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  const updated = await prisma.unitOfMeasure.update({
    where: { id },
    data: {
      name: input.name,
      symbol: input.symbol ?? null,
      kind: input.kind ?? null,
      isActive: input.is_active ?? existing.isActive,
    },
  });
  await writeTrail({ entityType: 'UnitOfMeasure', entityId: id, action: 'UPDATE' }, userId);
  return serialize(updated);
};

export const deleteUnit = async (id: string, userId?: string) => {
  await getRow(id);
  await prisma.unitOfMeasure.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'UnitOfMeasure', entityId: id, action: 'DELETE' }, userId);
};
