/** LIMS Master Data — Analytes (measurable quantities referenced by specs/tests). */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { ListAnalyteQuery, AnalyteUpsertInput } from './analyte.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.analyte.count();
  return `ANL-${String(count + 1).padStart(3, '0')}`;
};

const serialize = (a: Prisma.AnalyteGetPayload<object>) => ({
  id: a.id,
  code: a.code,
  name: a.name,
  default_unit: a.defaultUnit,
  data_type: a.dataType,
  category: a.category,
  is_active: a.isActive,
  created_at: a.createdAt,
  updated_at: a.updatedAt,
});

export const listAnalytes = async (q: ListAnalyteQuery) => {
  const where: Prisma.AnalyteWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { category: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.analyte.count({ where }),
    prisma.analyte.findMany({ where, orderBy: { code: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map(serialize), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string) => {
  const a = await prisma.analyte.findFirst({ where: { id, isDeleted: false } });
  if (!a) throw NotFound('Analyte not found');
  return a;
};

export const getAnalyte = async (id: string) => serialize(await getRow(id));

export const createAnalyte = async (input: AnalyteUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.analyte.create({
    data: {
      code,
      name: input.name,
      defaultUnit: input.default_unit ?? null,
      dataType: input.data_type,
      category: input.category ?? null,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'Analyte', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return serialize(created);
};

export const updateAnalyte = async (id: string, input: AnalyteUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  const updated = await prisma.analyte.update({
    where: { id },
    data: {
      name: input.name,
      defaultUnit: input.default_unit ?? null,
      dataType: input.data_type,
      category: input.category ?? null,
      isActive: input.is_active ?? existing.isActive,
    },
  });
  await writeTrail({ entityType: 'Analyte', entityId: id, action: 'UPDATE' }, userId);
  return serialize(updated);
};

export const deleteAnalyte = async (id: string, userId?: string) => {
  await getRow(id);
  await prisma.analyte.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'Analyte', entityId: id, action: 'DELETE' }, userId);
};
