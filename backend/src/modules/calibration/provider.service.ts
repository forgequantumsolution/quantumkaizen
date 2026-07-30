/**
 * Calibration providers — internal departments and external agencies.
 *
 * Module-owned rather than the LIMS `Supplier` master: a tenant running only
 * Calibration still needs somewhere to record who calibrated a gauge, and a
 * tenant running both can point `limsSupplierId` at their vendor record.
 */
import { Prisma } from '@prisma/client';
import type { CalibrationProvider } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/httpError';
import { trail } from './integrations';
import { daysUntil } from './calibration.lib';
import type { ListProvidersQuery, ProviderUpsertInput } from './calibration.schema';

const parseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const serializeProvider = (p: CalibrationProvider, eventCount?: number) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  type: p.type,
  contact_name: p.contactName,
  email: p.email,
  phone: p.phone,
  country: p.country,
  accreditation_body: p.accreditationBody,
  accreditation_no: p.accreditationNo,
  accreditation_scope: p.accreditationScope,
  accreditation_expiry: p.accreditationExpiry,
  accreditation_days_left: daysUntil(p.accreditationExpiry),
  /**
   * A certificate from a provider whose ISO/IEC 17025 accreditation had lapsed
   * is a finding in every regime, so the state is surfaced, not just the date.
   */
  accreditation_lapsed: !!p.accreditationExpiry && p.accreditationExpiry.getTime() < Date.now(),
  lims_supplier_id: p.limsSupplierId,
  is_active: p.isActive,
  event_count: eventCount,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

const nextCode = async (): Promise<string> => {
  const rows = await prisma.calibrationProvider.findMany({
    where: { code: { startsWith: 'CP-' } },
    select: { code: true },
  });
  const max = rows.reduce((acc, r) => {
    const n = Number(r.code.slice(3));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `CP-${String(max + 1).padStart(3, '0')}`;
};

export const listProviders = async (q: ListProvidersQuery) => {
  const where: Prisma.CalibrationProviderWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.type) where.type = q.type;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { accreditationNo: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.calibrationProvider.count({ where }),
    prisma.calibrationProvider.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
      include: { _count: { select: { events: true } } },
    }),
  ]);

  return {
    data: rows.map((r) => serializeProvider(r, r._count.events)),
    total,
    page: q.page,
    page_size: q.page_size,
  };
};

export const getProvider = async (id: string) => {
  const p = await prisma.calibrationProvider.findFirst({
    where: { id, isDeleted: false },
    include: { _count: { select: { events: true, plans: true } } },
  });
  if (!p) throw NotFound('Provider not found');

  // On-time and out-of-tolerance rates — the supplier-quality read on a
  // calibration agency, computed from this module's own records.
  const events = await prisma.calibrationEvent.findMany({
    where: { providerId: id, isDeleted: false, status: 'APPROVED' },
    select: { scheduledFor: true, performedAt: true, asFoundOutcome: true },
  });
  const dated = events.filter((e) => e.scheduledFor && e.performedAt);
  const onTime = dated.filter((e) => e.performedAt!.getTime() <= e.scheduledFor!.getTime()).length;
  const ootCount = events.filter((e) => e.asFoundOutcome === 'FAIL').length;

  return {
    ...serializeProvider(p, p._count.events),
    plan_count: p._count.plans,
    performance: {
      completed_calibrations: events.length,
      on_time_rate: dated.length ? Math.round((onTime / dated.length) * 100) : null,
      as_found_failure_rate: events.length ? Math.round((ootCount / events.length) * 100) : null,
    },
  };
};

export const createProvider = async (input: ProviderUpsertInput, userId?: string) => {
  const code = input.code?.trim() || (await nextCode());
  const clash = await prisma.calibrationProvider.findUnique({ where: { code } });
  if (clash) throw Conflict(`Provider code "${code}" already exists`);

  const created = await prisma.calibrationProvider.create({
    data: {
      code,
      name: input.name,
      type: input.type,
      contactName: input.contact_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      country: input.country ?? null,
      accreditationBody: input.accreditation_body ?? null,
      accreditationNo: input.accreditation_no ?? null,
      accreditationScope: input.accreditation_scope ?? null,
      accreditationExpiry: parseDate(input.accreditation_expiry),
      limsSupplierId: input.lims_supplier_id ?? null,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });

  await trail(
    { entityType: 'CalibrationProvider', entityId: created.id, action: 'CREATE', newValue: `${code} — ${created.name}` },
    userId,
  );
  return serializeProvider(created);
};

export const updateProvider = async (id: string, input: ProviderUpsertInput, userId?: string) => {
  const existing = await prisma.calibrationProvider.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Provider not found');

  const updated = await prisma.calibrationProvider.update({
    where: { id },
    data: {
      name: input.name,
      type: input.type,
      contactName: input.contact_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      country: input.country ?? null,
      accreditationBody: input.accreditation_body ?? null,
      accreditationNo: input.accreditation_no ?? null,
      accreditationScope: input.accreditation_scope ?? null,
      accreditationExpiry: parseDate(input.accreditation_expiry),
      limsSupplierId: input.lims_supplier_id ?? null,
      isActive: input.is_active ?? existing.isActive,
    },
  });

  await trail(
    { entityType: 'CalibrationProvider', entityId: id, action: 'UPDATE', oldValue: existing.name, newValue: updated.name },
    userId,
  );
  return serializeProvider(updated);
};

export const deleteProvider = async (id: string, userId?: string) => {
  const existing = await prisma.calibrationProvider.findFirst({
    where: { id, isDeleted: false },
    include: { _count: { select: { events: true } } },
  });
  if (!existing) throw NotFound('Provider not found');
  if (existing._count.events > 0) {
    throw Conflict(
      `${existing._count.events} calibration record(s) reference this provider — deactivate it instead of deleting`,
    );
  }
  await prisma.calibrationProvider.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await trail({ entityType: 'CalibrationProvider', entityId: id, action: 'DELETE', oldValue: existing.code }, userId);
};

/** Providers whose accreditation has lapsed or is about to — a standing risk. */
export const listExpiringAccreditations = async (withinDays = 60) => {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + withinDays);

  const rows = await prisma.calibrationProvider.findMany({
    where: { isDeleted: false, isActive: true, accreditationExpiry: { not: null, lte: horizon } },
    orderBy: { accreditationExpiry: 'asc' },
  });
  return { data: rows.map((r) => serializeProvider(r)), total: rows.length };
};
