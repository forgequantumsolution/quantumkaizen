/** LIMS Master Data — Products (finished/in-process products under test). */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { ListProductQuery, ProductUpsertInput } from './product.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.product.count();
  return `PRD-${String(count + 1).padStart(3, '0')}`;
};

const serialize = (p: Prisma.ProductGetPayload<object>) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  grade: p.grade,
  dosage_form: p.dosageForm,
  strength: p.strength,
  category: p.category,
  markets: p.markets,
  is_active: p.isActive,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

export const listProducts = async (q: ListProductQuery) => {
  const where: Prisma.ProductWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { grade: { contains: q.search, mode: 'insensitive' } },
      { category: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy: { code: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map(serialize), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string) => {
  const p = await prisma.product.findFirst({ where: { id, isDeleted: false } });
  if (!p) throw NotFound('Product not found');
  return p;
};

export const getProduct = async (id: string) => serialize(await getRow(id));

export const createProduct = async (input: ProductUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.product.create({
    data: {
      code,
      name: input.name,
      grade: input.grade ?? null,
      dosageForm: input.dosage_form ?? null,
      strength: input.strength ?? null,
      category: input.category ?? null,
      markets: input.markets ?? null,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'Product', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return serialize(created);
};

export const updateProduct = async (id: string, input: ProductUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  const updated = await prisma.product.update({
    where: { id },
    data: {
      name: input.name,
      grade: input.grade ?? null,
      dosageForm: input.dosage_form ?? null,
      strength: input.strength ?? null,
      category: input.category ?? null,
      markets: input.markets ?? null,
      isActive: input.is_active ?? existing.isActive,
    },
  });
  await writeTrail({ entityType: 'Product', entityId: id, action: 'UPDATE' }, userId);
  return serialize(updated);
};

export const deleteProduct = async (id: string, userId?: string) => {
  await getRow(id);
  await prisma.product.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'Product', entityId: id, action: 'DELETE' }, userId);
};
