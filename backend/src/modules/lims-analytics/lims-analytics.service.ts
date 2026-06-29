/**
 * LIMS 2.0 — L11 TAT/workload + L12 dashboard & data-review. All derived from
 * existing tables, no new schema.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { AuditReviewQuery } from './lims-analytics.schema';

const DAY = 86_400_000;

/** L12 — LIMS dashboard KPIs. */
export const dashboard = async () => {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);

  const [sampleByStatus, pendingReviews, openOos, totalSamples30, oosSamples30, qcRejects30, stabilityDue, equipmentOverdue, certsExpiring, coasIssued, samplesInTesting] = await Promise.all([
    prisma.sample.groupBy({ by: ['status'], where: { isDeleted: false }, _count: true }),
    prisma.sampleTest.count({ where: { status: 'COMPLETED', reviewStatus: 'PENDING' } }),
    prisma.oosInvestigation.count({ where: { status: { not: 'CLOSED' } } }),
    prisma.sample.count({ where: { isDeleted: false, createdAt: { gte: since30 } } }),
    prisma.sampleTest.count({ where: { overallResult: 'OOS', createdAt: { gte: since30 } } }),
    prisma.qcResult.count({ where: { status: 'REJECT', createdAt: { gte: since30 } } }),
    prisma.stabilityPull.count({ where: { status: 'DUE' } }),
    prisma.equipment.count({ where: { isDeleted: false, calibrationDueAt: { lt: now } } }),
    prisma.certification.count({ where: { isDeleted: false, expiryDate: { lte: in30 } } }),
    prisma.coa.count({ where: { isDeleted: false, status: 'ISSUED' } }),
    prisma.sample.count({ where: { isDeleted: false, status: 'IN_TESTING' } }),
  ]);

  return {
    samples_by_status: sampleByStatus.map((s) => ({ status: s.status, count: s._count })),
    kpis: {
      samples_in_testing: samplesInTesting,
      pending_reviews: pendingReviews,
      open_oos: openOos,
      oos_rate_30d: totalSamples30 ? Math.round((oosSamples30 / totalSamples30) * 1000) / 10 : 0,
      qc_rejects_30d: qcRejects30,
      stability_due_pulls: stabilityDue,
      equipment_overdue: equipmentOverdue,
      certs_expiring_30d: certsExpiring,
      coas_issued: coasIssued,
    },
  };
};

/** L11 — turnaround time over released samples. */
export const tat = async () => {
  const released = await prisma.sample.findMany({ where: { isDeleted: false, status: 'RELEASED', releasedAt: { not: null }, receivedAt: { not: null } }, select: { receivedAt: true, releasedAt: true }, take: 500, orderBy: { releasedAt: 'desc' } });
  const days = released.map((s) => (+s.releasedAt! - +s.receivedAt!) / DAY).filter((d) => d >= 0);
  const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
  const sorted = [...days].sort((a, b) => a - b);
  const p90 = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 0;
  const overdue = await prisma.sample.count({ where: { isDeleted: false, status: 'IN_TESTING', receivedAt: { lt: new Date(Date.now() - 10 * DAY) } } });
  return { released_count: days.length, avg_tat_days: Math.round(avg * 10) / 10, p90_tat_days: Math.round(p90 * 10) / 10, overdue_in_testing: overdue };
};

/** L11 — analyst workload + backlog. */
export const workload = async () => {
  const byStatus = await prisma.sampleTest.groupBy({ by: ['status'], _count: true });
  const byAnalyst = await prisma.sampleTest.groupBy({ by: ['analystName'], where: { status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] } }, _count: true });
  return {
    by_status: byStatus.map((s) => ({ status: s.status, count: s._count })),
    by_analyst: byAnalyst.map((a) => ({ analyst: a.analystName ?? 'Unassigned', count: a._count })).sort((a, b) => b.count - a.count),
    open_worklists: await prisma.worklist.count({ where: { isDeleted: false, status: { not: 'CLOSED' } } }),
  };
};

/** L12 — data-review: filterable audit-trail feed. */
export const auditReview = async (q: AuditReviewQuery) => {
  const where: Prisma.AuditTrailEntryWhereInput = {};
  if (q.entity_type) where.entityType = q.entity_type;
  if (q.action) where.action = q.action;
  if (q.user) where.userName = { contains: q.user, mode: 'insensitive' };
  if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
  if (q.search) where.OR = [{ entityType: { contains: q.search, mode: 'insensitive' } }, { newValue: { contains: q.search, mode: 'insensitive' } }, { reason: { contains: q.search, mode: 'insensitive' } }];
  const take = q.page_size ?? 100;
  const [total, rows] = await Promise.all([
    prisma.auditTrailEntry.count({ where }),
    prisma.auditTrailEntry.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip: ((q.page ?? 1) - 1) * take }),
  ]);
  return {
    total, page: q.page ?? 1, page_size: take,
    data: rows.map((t) => ({ id: t.id, entity_type: t.entityType, entity_id: t.entityId, action: t.action, field: t.field, old_value: t.oldValue, new_value: t.newValue, reason: t.reason, user_name: t.userName, created_at: t.createdAt })),
  };
};

/** Distinct entity types present in the trail — for the review filter. */
export const auditEntityTypes = async () => {
  const rows = await prisma.auditTrailEntry.findMany({ distinct: ['entityType'], select: { entityType: true }, orderBy: { entityType: 'asc' } });
  return { data: rows.map((r) => r.entityType) };
};
