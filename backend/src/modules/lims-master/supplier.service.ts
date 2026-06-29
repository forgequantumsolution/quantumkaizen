/** LIMS Master Data — Suppliers (external vendors of materials/services). */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { ListSupplierQuery, SupplierUpsertInput } from './supplier.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.supplier.count();
  return `SUP-${String(count + 1).padStart(3, '0')}`;
};

const serialize = (s: Prisma.SupplierGetPayload<object>) => ({
  id: s.id,
  code: s.code,
  name: s.name,
  contact_name: s.contactName,
  email: s.email,
  country: s.country,
  is_active: s.isActive,
  created_at: s.createdAt,
  updated_at: s.updatedAt,
});

export const listSuppliers = async (q: ListSupplierQuery) => {
  const where: Prisma.SupplierWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { contactName: { contains: q.search, mode: 'insensitive' } },
      { country: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({ where, orderBy: { code: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map(serialize), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string) => {
  const s = await prisma.supplier.findFirst({ where: { id, isDeleted: false } });
  if (!s) throw NotFound('Supplier not found');
  return s;
};

export const getSupplier = async (id: string) => serialize(await getRow(id));

export const createSupplier = async (input: SupplierUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.supplier.create({
    data: {
      code,
      name: input.name,
      contactName: input.contact_name ?? null,
      email: input.email ?? null,
      country: input.country ?? null,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'Supplier', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return serialize(created);
};

export const updateSupplier = async (id: string, input: SupplierUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      name: input.name,
      contactName: input.contact_name ?? null,
      email: input.email ?? null,
      country: input.country ?? null,
      isActive: input.is_active ?? existing.isActive,
    },
  });
  await writeTrail({ entityType: 'Supplier', entityId: id, action: 'UPDATE' }, userId);
  return serialize(updated);
};

export const deleteSupplier = async (id: string, userId?: string) => {
  await getRow(id);
  await prisma.supplier.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'Supplier', entityId: id, action: 'DELETE' }, userId);
};
