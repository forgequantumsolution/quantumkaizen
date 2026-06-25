/** LIMS Master — Customers (master-data entity for test request originators). */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { ListCustomerQuery, CustomerUpsertInput } from './customer.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.customer.count();
  return `CUS-${String(count + 1).padStart(3, '0')}`;
};

const serialize = (c: Prisma.CustomerGetPayload<object>) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  contact_name: c.contactName,
  email: c.email,
  country: c.country,
  is_active: c.isActive,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

export const listCustomers = async (q: ListCustomerQuery) => {
  const where: Prisma.CustomerWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { contactName: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({ where, orderBy: { code: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map(serialize), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string) => {
  const c = await prisma.customer.findFirst({ where: { id, isDeleted: false } });
  if (!c) throw NotFound('Customer not found');
  return c;
};

export const getCustomer = async (id: string) => serialize(await getRow(id));

export const createCustomer = async (input: CustomerUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.customer.create({
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
  await writeTrail({ entityType: 'Customer', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return serialize(created);
};

export const updateCustomer = async (id: string, input: CustomerUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  const updated = await prisma.customer.update({
    where: { id },
    data: {
      name: input.name,
      contactName: input.contact_name ?? null,
      email: input.email ?? null,
      country: input.country ?? null,
      isActive: input.is_active ?? existing.isActive,
    },
  });
  await writeTrail({ entityType: 'Customer', entityId: id, action: 'UPDATE' }, userId);
  return serialize(updated);
};

export const deleteCustomer = async (id: string, userId?: string) => {
  await getRow(id);
  await prisma.customer.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'Customer', entityId: id, action: 'DELETE' }, userId);
};
