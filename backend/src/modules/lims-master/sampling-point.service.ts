/** LIMS Master — Sampling Points (physical/logical locations where samples are drawn). */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { ListSamplingPointQuery, SamplingPointUpsertInput } from './sampling-point.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.samplingPoint.count();
  return `SP-${String(count + 1).padStart(3, '0')}`;
};

const serialize = (s: Prisma.SamplingPointGetPayload<object>) => ({
  id: s.id,
  code: s.code,
  name: s.name,
  area: s.area,
  description: s.description,
  is_active: s.isActive,
  created_at: s.createdAt,
  updated_at: s.updatedAt,
});

export const listSamplingPoints = async (q: ListSamplingPointQuery) => {
  const where: Prisma.SamplingPointWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { area: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.samplingPoint.count({ where }),
    prisma.samplingPoint.findMany({ where, orderBy: { code: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map(serialize), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string) => {
  const s = await prisma.samplingPoint.findFirst({ where: { id, isDeleted: false } });
  if (!s) throw NotFound('Sampling point not found');
  return s;
};

export const getSamplingPoint = async (id: string) => serialize(await getRow(id));

export const createSamplingPoint = async (input: SamplingPointUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.samplingPoint.create({
    data: {
      code,
      name: input.name,
      area: input.area ?? null,
      description: input.description ?? null,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'SamplingPoint', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return serialize(created);
};

export const updateSamplingPoint = async (id: string, input: SamplingPointUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  const updated = await prisma.samplingPoint.update({
    where: { id },
    data: {
      name: input.name,
      area: input.area ?? null,
      description: input.description ?? null,
      isActive: input.is_active ?? existing.isActive,
    },
  });
  await writeTrail({ entityType: 'SamplingPoint', entityId: id, action: 'UPDATE' }, userId);
  return serialize(updated);
};

export const deleteSamplingPoint = async (id: string, userId?: string) => {
  await getRow(id);
  await prisma.samplingPoint.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'SamplingPoint', entityId: id, action: 'DELETE' }, userId);
};
