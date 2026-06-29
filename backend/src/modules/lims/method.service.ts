/** LIMS — Test Methods (analytical methods referenced by spec parameters + tests). */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { ListMethodQuery, MethodUpsertInput } from './method.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.testMethod.count();
  return `MTH-${String(count + 1).padStart(3, '0')}`;
};

const serialize = (m: Prisma.TestMethodGetPayload<object>) => ({
  id: m.id,
  code: m.code,
  name: m.name,
  technique: m.technique,
  sop_ref: m.sopRef,
  document_id: m.documentId,
  description: m.description,
  default_unit: m.defaultUnit,
  price: m.price,
  is_active: m.isActive,
  created_at: m.createdAt,
  updated_at: m.updatedAt,
});

export const listMethods = async (q: ListMethodQuery) => {
  const where: Prisma.TestMethodWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { technique: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.testMethod.count({ where }),
    prisma.testMethod.findMany({ where, orderBy: { code: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map(serialize), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string) => {
  const m = await prisma.testMethod.findFirst({ where: { id, isDeleted: false } });
  if (!m) throw NotFound('Test method not found');
  return m;
};

export const getMethod = async (id: string) => serialize(await getRow(id));

export const createMethod = async (input: MethodUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.testMethod.create({
    data: {
      code,
      name: input.name,
      technique: input.technique ?? null,
      sopRef: input.sop_ref ?? null,
      documentId: input.document_id ?? null,
      description: input.description ?? null,
      defaultUnit: input.default_unit ?? null,
      price: input.price ?? null,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'TestMethod', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return serialize(created);
};

export const updateMethod = async (id: string, input: MethodUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  const updated = await prisma.testMethod.update({
    where: { id },
    data: {
      name: input.name,
      technique: input.technique ?? null,
      sopRef: input.sop_ref ?? null,
      documentId: input.document_id ?? null,
      description: input.description ?? null,
      defaultUnit: input.default_unit ?? null,
      price: input.price ?? null,
      isActive: input.is_active ?? existing.isActive,
    },
  });
  await writeTrail({ entityType: 'TestMethod', entityId: id, action: 'UPDATE' }, userId);
  return serialize(updated);
};

export const deleteMethod = async (id: string, userId?: string) => {
  await getRow(id);
  await prisma.testMethod.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'TestMethod', entityId: id, action: 'DELETE' }, userId);
};
