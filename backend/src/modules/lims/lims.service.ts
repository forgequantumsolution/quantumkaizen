/**
 * LIMS service — Lab Registry (first LIMS master-data entity). Equipment,
 * specifications and methods will be added under this module.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { LabUpsertInput, ListLabsQuery } from './lims.schema';

const nextLabCode = async (): Promise<string> => {
  const count = await prisma.lab.count();
  return `LAB-${String(count + 1).padStart(3, '0')}`;
};

const serializeLab = (l: Prisma.LabGetPayload<object>) => ({
  id: l.id,
  code: l.code,
  name: l.name,
  type: l.type,
  gmp_class: l.gmpClass,
  site_code: l.siteCode,
  location: l.location,
  accreditation: l.accreditation,
  contact_name: l.contactName,
  contact_email: l.contactEmail,
  is_active: l.isActive,
  created_at: l.createdAt,
  updated_at: l.updatedAt,
});

export const listLabs = async (q: ListLabsQuery) => {
  const where: Prisma.LabWhereInput = { isDeleted: false };
  if (q.type) where.type = q.type;
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { location: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.lab.count({ where }),
    prisma.lab.findMany({ where, orderBy: { code: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map(serializeLab), total, page: q.page, page_size: q.page_size };
};

export const getLab = async (id: string) => {
  const l = await prisma.lab.findFirst({ where: { id, isDeleted: false } });
  if (!l) throw NotFound('Lab not found');
  return serializeLab(l);
};

const cleanEmail = (e?: string | null) => (e ? e : null);

export const createLab = async (input: LabUpsertInput, userId?: string) => {
  const code = await nextLabCode();
  const created = await prisma.lab.create({
    data: {
      code,
      name: input.name,
      type: input.type,
      gmpClass: input.gmp_class ?? null,
      siteCode: input.site_code ?? null,
      location: input.location ?? null,
      accreditation: input.accreditation ?? null,
      contactName: input.contact_name ?? null,
      contactEmail: cleanEmail(input.contact_email),
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'Lab', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return serializeLab(created);
};

export const updateLab = async (id: string, input: LabUpsertInput, userId?: string) => {
  const existing = await prisma.lab.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Lab not found');
  const updated = await prisma.lab.update({
    where: { id },
    data: {
      name: input.name,
      type: input.type,
      gmpClass: input.gmp_class ?? null,
      siteCode: input.site_code ?? null,
      location: input.location ?? null,
      accreditation: input.accreditation ?? null,
      contactName: input.contact_name ?? null,
      contactEmail: cleanEmail(input.contact_email),
      isActive: input.is_active ?? existing.isActive,
    },
  });
  await writeTrail({ entityType: 'Lab', entityId: id, action: 'UPDATE' }, userId);
  return serializeLab(updated);
};

export const deleteLab = async (id: string, userId?: string) => {
  const existing = await prisma.lab.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Lab not found');
  await prisma.lab.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'Lab', entityId: id, action: 'DELETE' }, userId);
};
