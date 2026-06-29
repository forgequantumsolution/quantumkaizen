/**
 * LIMS — Certifications (GMP/NABL/ISO/USFDA …) with expiry tracking. A sweep
 * flags certs expiring within 30 days / expired (the hook for alerts), mirroring
 * the DMS review sweep; the flag clears on renewal (expiry date moved forward).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { CertUpsertInput, ListCertQuery } from './certification.schema';

const DAY = 86_400_000;

const nextCode = async (): Promise<string> => {
  const count = await prisma.certification.count();
  return `CERT-${String(count + 1).padStart(3, '0')}`;
};

const labNames = async (ids: (string | null)[]) => {
  const u = [...new Set(ids.filter((x): x is string => !!x))];
  const labs = u.length ? await prisma.lab.findMany({ where: { id: { in: u } }, select: { id: true, name: true } }) : [];
  return new Map(labs.map((l) => [l.id, l.name]));
};

const serialize = (c: Prisma.CertificationGetPayload<object>, names: Map<string, string>) => {
  const days = Math.ceil((c.expiryDate.getTime() - Date.now()) / DAY);
  const state = days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'valid';
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    number: c.number,
    lab_id: c.labId,
    lab_name: c.labId ? names.get(c.labId) ?? null : null,
    issued_by: c.issuedBy,
    issue_date: c.issueDate,
    expiry_date: c.expiryDate,
    days_to_expiry: days,
    expiry_state: state,
    is_active: c.isActive,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
};

export const listCertifications = async (q: ListCertQuery) => {
  const where: Prisma.CertificationWhereInput = { isDeleted: false };
  if (q.lab_id) where.labId = q.lab_id;
  if (q.expiring) {
    const horizon = new Date(Date.now() + 30 * DAY);
    where.expiryDate = { lte: horizon };
  }
  if (q.search) {
    where.OR = [
      { type: { contains: q.search, mode: 'insensitive' } },
      { number: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.certification.count({ where }),
    prisma.certification.findMany({ where, orderBy: { expiryDate: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  const names = await labNames(rows.map((r) => r.labId));
  return { data: rows.map((r) => serialize(r, names)), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string) => {
  const c = await prisma.certification.findFirst({ where: { id, isDeleted: false } });
  if (!c) throw NotFound('Certification not found');
  return c;
};

export const getCertification = async (id: string) => {
  const c = await getRow(id);
  const names = await labNames([c.labId]);
  return serialize(c, names);
};

export const createCertification = async (input: CertUpsertInput, userId?: string) => {
  const expiry = new Date(input.expiry_date);
  if (Number.isNaN(expiry.getTime())) throw BadRequest('Invalid expiry date');
  const code = await nextCode();
  const created = await prisma.certification.create({
    data: {
      code,
      type: input.type,
      number: input.number ?? null,
      labId: input.lab_id ?? null,
      issuedBy: input.issued_by ?? null,
      issueDate: input.issue_date ? new Date(input.issue_date) : null,
      expiryDate: expiry,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'Certification', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return getCertification(created.id);
};

export const updateCertification = async (id: string, input: CertUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  const expiry = new Date(input.expiry_date);
  if (Number.isNaN(expiry.getTime())) throw BadRequest('Invalid expiry date');
  // Renewal (expiry moved later than the flagged date) clears the expiry flag.
  const clearFlag = existing.expiryFlaggedAt && expiry.getTime() > existing.expiryDate.getTime();
  await prisma.certification.update({
    where: { id },
    data: {
      type: input.type,
      number: input.number ?? null,
      labId: input.lab_id ?? null,
      issuedBy: input.issued_by ?? null,
      issueDate: input.issue_date ? new Date(input.issue_date) : null,
      expiryDate: expiry,
      isActive: input.is_active ?? existing.isActive,
      ...(clearFlag ? { expiryFlaggedAt: null } : {}),
    },
  });
  await writeTrail({ entityType: 'Certification', entityId: id, action: 'UPDATE' }, userId);
  return getCertification(id);
};

export const deleteCertification = async (id: string, userId?: string) => {
  await getRow(id);
  await prisma.certification.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'Certification', entityId: id, action: 'DELETE' }, userId);
};

// Sweep: flag active certifications expiring within 30 days (or expired) and not
// yet flagged. Runs on the worker cron tick + audit-sweep CLI.
export const flagExpiringCertifications = async (now = new Date()) => {
  const horizon = new Date(now.getTime() + 30 * DAY);
  const due = await prisma.certification.findMany({
    where: { isDeleted: false, isActive: true, expiryFlaggedAt: null, expiryDate: { lte: horizon } },
    select: { id: true, code: true, expiryDate: true },
  });
  for (const c of due) {
    await prisma.certification.update({ where: { id: c.id }, data: { expiryFlaggedAt: now } });
    await writeTrail({ entityType: 'Certification', entityId: c.id, action: 'UPDATE', field: 'expiry_alert', newValue: c.expiryDate.toISOString() }, undefined);
  }
  return { flagged_count: due.length, flagged: due.map((c) => c.code) };
};
