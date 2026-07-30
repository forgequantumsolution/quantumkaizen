/**
 * Calibration analytics — every figure derived from this module's own records.
 *
 * Nothing here reads another module, and nothing is hardcoded: a fresh install
 * returns honest zeroes rather than plausible-looking demo numbers.
 */
import { prisma } from '../../lib/prisma';
import { addDays, num, resolveConfig } from './calibration.lib';
import { probeIntegrations } from './integrations';
import type { AnalyticsQuery } from './calibration.schema';

const pct = (numer: number, denom: number): number | null =>
  denom === 0 ? null : Math.round((numer / denom) * 1000) / 10;

/** Headline KPIs for the module dashboard. */
export const getSummary = async (q: AnalyticsQuery) => {
  const siteFilter = q.site_id ? { siteId: q.site_id } : {};
  const now = new Date();
  const cfg = await resolveConfig(q.site_id ?? null);
  const soon = addDays(now, cfg.dueSoonWindowDays);
  const windowStart = addDays(now, -q.days);

  const [byStatus, byCriticality, total, dueSoon, overdue, openOot, events, lapsedStandards, missingPlans] =
    await Promise.all([
      prisma.calibrationInstrument.groupBy({
        by: ['calibrationStatus'],
        where: { isDeleted: false, status: { not: 'RETIRED' }, ...siteFilter },
        _count: { _all: true },
      }),
      prisma.calibrationInstrument.groupBy({
        by: ['criticality'],
        where: { isDeleted: false, status: { not: 'RETIRED' }, ...siteFilter },
        _count: { _all: true },
      }),
      prisma.calibrationInstrument.count({
        where: { isDeleted: false, status: { not: 'RETIRED' }, ...siteFilter },
      }),
      prisma.calibrationInstrument.count({
        where: {
          isDeleted: false,
          status: { not: 'RETIRED' },
          isCalibrationRequired: true,
          calibrationDueAt: { gte: now, lte: soon },
          ...siteFilter,
        },
      }),
      prisma.calibrationInstrument.count({
        where: {
          isDeleted: false,
          status: { not: 'RETIRED' },
          isCalibrationRequired: true,
          calibrationDueAt: { lt: now },
          ...siteFilter,
        },
      }),
      prisma.outOfToleranceAssessment.count({
        where: { isDeleted: false, status: { not: 'CLOSED' }, ...(q.site_id ? { event: { siteId: q.site_id } } : {}) },
      }),
      prisma.calibrationEvent.findMany({
        where: {
          isDeleted: false,
          status: 'APPROVED',
          performedAt: { gte: windowStart },
          ...(q.site_id ? { siteId: q.site_id } : {}),
        },
        select: { performedAt: true, scheduledFor: true, asFoundOutcome: true, overallOutcome: true },
      }),
      prisma.calibrationInstrument.count({
        where: {
          isDeleted: false,
          kind: 'REFERENCE_STANDARD',
          status: { not: 'RETIRED' },
          calibrationDueAt: { lt: now },
          ...siteFilter,
        },
      }),
      prisma.calibrationInstrument.count({
        where: {
          isDeleted: false,
          status: { not: 'RETIRED' },
          isCalibrationRequired: true,
          plans: { none: { isActive: true, isDeleted: false } },
          ...siteFilter,
        },
      }),
    ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.calibrationStatus, s._count._all]));
  const calibrated = statusMap.CALIBRATED ?? 0;

  // On-time = performed on or before the date it was scheduled for.
  const dated = events.filter((e) => e.performedAt && e.scheduledFor);
  const onTime = dated.filter((e) => e.performedAt!.getTime() <= e.scheduledFor!.getTime()).length;
  const asFoundFails = events.filter((e) => e.asFoundOutcome === 'FAIL').length;

  return {
    window_days: q.days,
    total_instruments: total,
    /**
     * Compliance = instruments in a healthy calibration state. Exempt and
     * retired instruments are excluded rather than counted as compliant, which
     * is the flattering version of this number.
     */
    compliance_rate: pct(calibrated + (statusMap.DUE_SOON ?? 0), total),
    calibrated,
    due_soon: dueSoon,
    overdue,
    under_calibration: statusMap.UNDER_CALIBRATION ?? 0,
    limited_use: statusMap.LIMITED_USE ?? 0,
    out_of_service: statusMap.OUT_OF_SERVICE ?? 0,
    not_required: statusMap.NOT_REQUIRED ?? 0,
    open_oot: openOot,
    lapsed_standards: lapsedStandards,
    instruments_without_plan: missingPlans,
    calibrations_completed: events.length,
    on_time_rate: pct(onTime, dated.length),
    as_found_failure_rate: pct(asFoundFails, events.length),
    by_status: byStatus.map((s) => ({ status: s.calibrationStatus, count: s._count._all })),
    by_criticality: byCriticality.map((c) => ({ criticality: c.criticality, count: c._count._all })),
  };
};

/** Forward calendar — what falls due, grouped by month. */
export const getSchedule = async (q: AnalyticsQuery) => {
  const from = new Date();
  const to = addDays(from, q.days);

  const [upcoming, overdue] = await Promise.all([
    prisma.calibrationInstrument.findMany({
      where: {
        isDeleted: false,
        status: { not: 'RETIRED' },
        isCalibrationRequired: true,
        calibrationDueAt: { gte: from, lte: to },
        ...(q.site_id ? { siteId: q.site_id } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        criticality: true,
        calibrationDueAt: true,
        calibrationStatus: true,
      },
      orderBy: { calibrationDueAt: 'asc' },
    }),
    prisma.calibrationInstrument.findMany({
      where: {
        isDeleted: false,
        status: { not: 'RETIRED' },
        isCalibrationRequired: true,
        calibrationDueAt: { lt: from },
        ...(q.site_id ? { siteId: q.site_id } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        criticality: true,
        calibrationDueAt: true,
        calibrationStatus: true,
      },
      orderBy: { calibrationDueAt: 'asc' },
    }),
  ]);

  const byMonth = new Map<string, number>();
  for (const i of upcoming) {
    if (!i.calibrationDueAt) continue;
    const key = i.calibrationDueAt.toISOString().slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  const map = (i: (typeof upcoming)[number]) => ({
    instrument_id: i.id,
    code: i.code,
    name: i.name,
    criticality: i.criticality,
    calibration_status: i.calibrationStatus,
    due_at: i.calibrationDueAt,
  });

  return {
    overdue: overdue.map(map),
    upcoming: upcoming.map(map),
    by_month: [...byMonth.entries()].sort().map(([month, count]) => ({ month, count })),
  };
};

/** Performance per instrument category — where the failures concentrate. */
export const getByCategory = async (q: AnalyticsQuery) => {
  const categories = await prisma.equipmentCategory.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, kind: true, _count: { select: { instruments: true } } },
    orderBy: { name: 'asc' },
  });

  const windowStart = addDays(new Date(), -q.days);
  const rows = await Promise.all(
    categories
      .filter((c) => c._count.instruments > 0)
      .map(async (c) => {
        const [overdue, events] = await Promise.all([
          prisma.calibrationInstrument.count({
            where: {
              categoryId: c.id,
              isDeleted: false,
              status: { not: 'RETIRED' },
              calibrationDueAt: { lt: new Date() },
            },
          }),
          prisma.calibrationEvent.findMany({
            where: {
              isDeleted: false,
              status: 'APPROVED',
              performedAt: { gte: windowStart },
              instrument: { categoryId: c.id },
            },
            select: { asFoundOutcome: true },
          }),
        ]);
        const fails = events.filter((e) => e.asFoundOutcome === 'FAIL').length;
        return {
          category_id: c.id,
          category_name: c.name,
          kind: c.kind,
          instrument_count: c._count.instruments,
          overdue_count: overdue,
          calibrations: events.length,
          as_found_failure_rate: pct(fails, events.length),
        };
      }),
  );

  return { data: rows };
};

/** External provider scorecard — on-time delivery and as-found failure rate. */
export const getProviderPerformance = async (q: AnalyticsQuery) => {
  const providers = await prisma.calibrationProvider.findMany({
    where: { isDeleted: false },
    select: { id: true, code: true, name: true, type: true, accreditationExpiry: true },
  });

  const windowStart = addDays(new Date(), -q.days);
  const rows = await Promise.all(
    providers.map(async (p) => {
      const events = await prisma.calibrationEvent.findMany({
        where: { providerId: p.id, isDeleted: false, status: 'APPROVED', performedAt: { gte: windowStart } },
        select: { performedAt: true, scheduledFor: true, asFoundOutcome: true },
      });
      const dated = events.filter((e) => e.performedAt && e.scheduledFor);
      const onTime = dated.filter((e) => e.performedAt!.getTime() <= e.scheduledFor!.getTime()).length;
      const fails = events.filter((e) => e.asFoundOutcome === 'FAIL').length;
      return {
        provider_id: p.id,
        code: p.code,
        name: p.name,
        type: p.type,
        accreditation_lapsed: !!p.accreditationExpiry && p.accreditationExpiry.getTime() < Date.now(),
        calibrations: events.length,
        on_time_rate: pct(onTime, dated.length),
        as_found_failure_rate: pct(fails, events.length),
      };
    }),
  );

  return { data: rows.filter((r) => r.calibrations > 0 || r.accreditation_lapsed) };
};

/**
 * Out-of-tolerance trend and the exposure it represents — the number a quality
 * head is actually asked about after an inspection finding.
 */
export const getOotTrend = async (q: AnalyticsQuery) => {
  const windowStart = addDays(new Date(), -q.days);
  const rows = await prisma.outOfToleranceAssessment.findMany({
    where: { isDeleted: false, createdAt: { gte: windowStart } },
    select: {
      createdAt: true,
      status: true,
      disposition: true,
      affectedResultIds: true,
      affectedSampleIds: true,
      affectedBatchRefs: true,
      maxObservedError: true,
    },
  });

  const byMonth = new Map<string, { count: number; confirmed: number }>();
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 7);
    const cur = byMonth.get(key) ?? { count: 0, confirmed: 0 };
    cur.count += 1;
    if (r.disposition === 'IMPACT_CONFIRMED') cur.confirmed += 1;
    byMonth.set(key, cur);
  }

  return {
    total: rows.length,
    open: rows.filter((r) => r.status !== 'CLOSED').length,
    impact_confirmed: rows.filter((r) => r.disposition === 'IMPACT_CONFIRMED').length,
    no_impact: rows.filter((r) => r.disposition === 'NO_IMPACT').length,
    total_affected_records: rows.reduce(
      (n, r) => n + r.affectedResultIds.length + r.affectedSampleIds.length + r.affectedBatchRefs.length,
      0,
    ),
    largest_error: rows.reduce<number | null>((acc, r) => {
      const v = num(r.maxObservedError);
      if (v === null) return acc;
      return acc === null || Math.abs(v) > Math.abs(acc) ? v : acc;
    }, null),
    by_month: [...byMonth.entries()].sort().map(([month, v]) => ({ month, ...v })),
  };
};

/**
 * What this deployment can actually do — read by the UI so it never offers a
 * "Raise CAPA" button that could only ever return a reason string.
 */
export const getCapabilities = async (siteId?: string | null) => {
  const cfg = await resolveConfig(siteId ?? null);
  const integrations = await probeIntegrations();
  return {
    industry_pack: cfg.industryPack,
    features: {
      msa: cfg.enableMsa,
      in_use_checks: cfg.enableInUseChecks,
      legal_metrology: cfg.enableLegalMetrology,
      aiq_groups: cfg.enableAiqGroups,
      usage_intervals: cfg.enableUsageIntervals,
    },
    integrations,
  };
};

// ─────────────────────────── Module overview ───────────────────────────

/**
 * One block per module surface, in a single round trip.
 *
 * The dashboard is the module's front door, so it should answer for every page
 * behind it — not just instruments. Fetching it as one call also means every
 * figure on screen is from the same instant; five independent queries would let
 * the KPI strip and the panels disagree while a sweep runs between them.
 */
export const getOverview = async (q: AnalyticsQuery) => {
  const now = new Date();
  const cfg = await resolveConfig(q.site_id ?? null);
  const site = q.site_id ? { siteId: q.site_id } : {};
  const eventSite = q.site_id ? { siteId: q.site_id } : {};
  const windowStart = addDays(now, -q.days);
  const liveInstrument = { isDeleted: false, status: { not: 'RETIRED' as const }, ...site };

  const [
    instByStatus,
    instByKind,
    instByCriticality,
    instTotal,
    withoutPlan,
    dueBuckets,
    nextDue,
    eventsByStatus,
    recentEvents,
    approvedInWindow,
    ootByStatus,
    recentOot,
    ootAgg,
    checksRecent,
    checksFailed,
    holdsOpen,
    standards,
    msaAll,
    providers,
    categoryStats,
  ] = await Promise.all([
    prisma.calibrationInstrument.groupBy({ by: ['calibrationStatus'], where: liveInstrument, _count: { _all: true } }),
    prisma.calibrationInstrument.groupBy({ by: ['kind'], where: liveInstrument, _count: { _all: true } }),
    prisma.calibrationInstrument.groupBy({ by: ['criticality'], where: liveInstrument, _count: { _all: true } }),
    prisma.calibrationInstrument.count({ where: liveInstrument }),
    prisma.calibrationInstrument.count({
      where: { ...liveInstrument, isCalibrationRequired: true, plans: { none: { isActive: true, isDeleted: false } } },
    }),
    Promise.all(
      [7, 30, 90].map((d) =>
        prisma.calibrationInstrument.count({
          where: { ...liveInstrument, isCalibrationRequired: true, calibrationDueAt: { gte: now, lte: addDays(now, d) } },
        }),
      ),
    ),
    prisma.calibrationInstrument.findMany({
      where: { ...liveInstrument, isCalibrationRequired: true, calibrationDueAt: { not: null } },
      select: { id: true, code: true, name: true, criticality: true, calibrationStatus: true, calibrationDueAt: true },
      orderBy: { calibrationDueAt: 'asc' },
      take: 6,
    }),
    prisma.calibrationEvent.groupBy({ by: ['status'], where: { isDeleted: false, ...eventSite }, _count: { _all: true } }),
    prisma.calibrationEvent.findMany({
      where: { isDeleted: false, ...eventSite },
      select: {
        id: true,
        eventNo: true,
        status: true,
        type: true,
        scheduledFor: true,
        performedAt: true,
        asFoundOutcome: true,
        overallOutcome: true,
        instrument: { select: { code: true, name: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 6,
    }),
    prisma.calibrationEvent.findMany({
      where: { isDeleted: false, status: 'APPROVED', performedAt: { gte: windowStart }, ...eventSite },
      select: { performedAt: true, scheduledFor: true, asFoundOutcome: true },
    }),
    prisma.outOfToleranceAssessment.groupBy({
      by: ['status'],
      where: { isDeleted: false, ...(q.site_id ? { event: { siteId: q.site_id } } : {}) },
      _count: { _all: true },
    }),
    prisma.outOfToleranceAssessment.findMany({
      where: { isDeleted: false, status: { not: 'CLOSED' }, ...(q.site_id ? { event: { siteId: q.site_id } } : {}) },
      select: {
        id: true,
        status: true,
        disposition: true,
        impactWindowFrom: true,
        impactWindowTo: true,
        affectedResultIds: true,
        affectedSampleIds: true,
        affectedBatchRefs: true,
        customerNotificationRequired: true,
        customerNotifiedAt: true,
        productHoldRequired: true,
        productHoldRef: true,
        event: { select: { eventNo: true, instrument: { select: { code: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.outOfToleranceAssessment.findMany({
      where: { isDeleted: false, createdAt: { gte: windowStart } },
      select: { disposition: true, affectedResultIds: true, affectedSampleIds: true, affectedBatchRefs: true, maxObservedError: true },
    }),
    prisma.inUseVerification.findMany({
      where: { isDeleted: false, performedAt: { gte: addDays(now, -7) } },
      select: {
        id: true,
        performedAt: true,
        outcome: true,
        shift: true,
        batchRef: true,
        holdTriggered: true,
        instrument: { select: { code: true, name: true } },
      },
      orderBy: { performedAt: 'desc' },
      take: 6,
    }),
    prisma.inUseVerification.count({ where: { isDeleted: false, outcome: 'FAIL', performedAt: { gte: addDays(now, -7) } } }),
    prisma.inUseVerification.count({ where: { isDeleted: false, holdTriggered: true, holdRef: null } }),
    prisma.calibrationInstrument.findMany({
      where: { isDeleted: false, kind: 'REFERENCE_STANDARD', status: { not: 'RETIRED' }, ...site },
      select: { id: true, code: true, name: true, calibrationDueAt: true, calibrationStatus: true },
    }),
    prisma.msaStudy.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        studyNo: true,
        verdict: true,
        grrPercent: true,
        approvedAt: true,
        performedAt: true,
        instrument: { select: { code: true, name: true } },
      },
      orderBy: { performedAt: 'desc' },
    }),
    prisma.calibrationProvider.findMany({
      where: { isDeleted: false },
      select: { id: true, code: true, name: true, isActive: true, accreditationExpiry: true, _count: { select: { events: true } } },
    }),
    prisma.equipmentCategory.findMany({
      where: { isDeleted: false },
      select: { id: true, isActive: true, requiresMsa: true, requiresInUseCheck: true, _count: { select: { instruments: true } } },
    }),
  ]);

  const statusMap = Object.fromEntries(instByStatus.map((s) => [s.calibrationStatus, s._count._all]));
  const evStatus = Object.fromEntries(eventsByStatus.map((s) => [s.status, s._count._all]));

  const datedApproved = approvedInWindow.filter((e) => e.performedAt && e.scheduledFor);
  const onTime = datedApproved.filter((e) => e.performedAt!.getTime() <= e.scheduledFor!.getTime()).length;
  const asFoundFails = approvedInWindow.filter((e) => e.asFoundOutcome === 'FAIL').length;

  const lapsedStandards = standards.filter((s) => s.calibrationDueAt && s.calibrationDueAt < now);
  const expiringStandards = standards.filter(
    (s) => s.calibrationDueAt && s.calibrationDueAt >= now && s.calibrationDueAt <= addDays(now, 60),
  );

  const lapsedProviders = providers.filter((p) => p.isActive && p.accreditationExpiry && p.accreditationExpiry < now);
  const expiringProviders = providers.filter(
    (p) => p.isActive && p.accreditationExpiry && p.accreditationExpiry >= now && p.accreditationExpiry <= addDays(now, 60),
  );

  // In-use checks owed right now, by the category's declared frequency.
  const monitored = await prisma.calibrationInstrument.findMany({
    where: { ...liveInstrument, status: 'ACTIVE', category: { requiresInUseCheck: true, isDeleted: false } },
    select: {
      id: true,
      category: { select: { inUseCheckFrequency: true } },
      inUseChecks: { orderBy: { performedAt: 'desc' }, take: 1, select: { performedAt: true } },
    },
  });
  const hoursFor = (f: string | null | undefined) =>
    f === 'DAILY' ? 24 : f === 'WEEKLY' ? 168 : f === 'MONTHLY' ? 720 : 8;
  const checksDue = monitored.filter((m) => {
    const last = m.inUseChecks[0];
    if (!last) return true;
    return now.getTime() - last.performedAt.getTime() > hoursFor(m.category?.inUseCheckFrequency) * 3_600_000;
  }).length;

  const openOot = ootByStatus.filter((o) => o.status !== 'CLOSED').reduce((n, o) => n + o._count._all, 0);
  const blocked =
    (cfg.blockUseWhenOverdue ? statusMap.OVERDUE ?? 0 : 0) + (cfg.blockUseWhenFailed ? statusMap.OUT_OF_SERVICE ?? 0 : 0);

  return {
    generated_at: now,
    window_days: q.days,
    config: {
      industry_pack: cfg.industryPack,
      due_soon_window_days: cfg.dueSoonWindowDays,
      enable_msa: cfg.enableMsa,
      enable_in_use_checks: cfg.enableInUseChecks,
      oot_impact_window: cfg.ootImpactWindow,
    },

    instruments: {
      total: instTotal,
      by_status: instByStatus.map((s) => ({ status: s.calibrationStatus, count: s._count._all })),
      by_kind: instByKind.map((k) => ({ kind: k.kind, count: k._count._all })),
      by_criticality: instByCriticality.map((c) => ({ criticality: c.criticality, count: c._count._all })),
      without_plan: withoutPlan,
      /** Instruments the config currently forbids using to produce data. */
      blocked_for_use: blocked,
      compliance_rate: pct((statusMap.CALIBRATED ?? 0) + (statusMap.DUE_SOON ?? 0), instTotal),
    },

    schedule: {
      overdue: statusMap.OVERDUE ?? 0,
      due_7: dueBuckets[0] ?? 0,
      due_30: dueBuckets[1] ?? 0,
      due_90: dueBuckets[2] ?? 0,
      next: nextDue.map((i) => ({
        instrument_id: i.id,
        code: i.code,
        name: i.name,
        criticality: i.criticality,
        calibration_status: i.calibrationStatus,
        due_at: i.calibrationDueAt,
      })),
    },

    events: {
      scheduled: evStatus.SCHEDULED ?? 0,
      in_progress: evStatus.IN_PROGRESS ?? 0,
      pending_review: evStatus.PENDING_REVIEW ?? 0,
      pending_approval: evStatus.PENDING_APPROVAL ?? 0,
      rejected: evStatus.REJECTED ?? 0,
      approved_total: evStatus.APPROVED ?? 0,
      /** Everything sitting in someone's queue right now. */
      open_workload:
        (evStatus.SCHEDULED ?? 0) + (evStatus.IN_PROGRESS ?? 0) + (evStatus.PENDING_REVIEW ?? 0) + (evStatus.PENDING_APPROVAL ?? 0),
      completed_in_window: approvedInWindow.length,
      on_time_rate: pct(onTime, datedApproved.length),
      as_found_failure_rate: pct(asFoundFails, approvedInWindow.length),
      recent: recentEvents.map((e) => ({
        id: e.id,
        event_no: e.eventNo,
        status: e.status,
        type: e.type,
        instrument_code: e.instrument?.code ?? null,
        instrument_name: e.instrument?.name ?? null,
        scheduled_for: e.scheduledFor,
        performed_at: e.performedAt,
        as_found_outcome: e.asFoundOutcome,
        overall_outcome: e.overallOutcome,
      })),
    },

    oot: {
      open: openOot,
      by_status: ootByStatus.map((o) => ({ status: o.status, count: o._count._all })),
      impact_confirmed: ootAgg.filter((o) => o.disposition === 'IMPACT_CONFIRMED').length,
      no_impact: ootAgg.filter((o) => o.disposition === 'NO_IMPACT').length,
      affected_records: ootAgg.reduce(
        (n, o) => n + o.affectedResultIds.length + o.affectedSampleIds.length + o.affectedBatchRefs.length,
        0,
      ),
      largest_error: ootAgg.reduce<number | null>((acc, o) => {
        const v = num(o.maxObservedError);
        if (v === null) return acc;
        return acc === null || Math.abs(v) > Math.abs(acc) ? v : acc;
      }, null),
      /** Obligations the pack demands but nobody has discharged yet. */
      awaiting_customer_notification: recentOot.filter((o) => o.customerNotificationRequired && !o.customerNotifiedAt).length,
      awaiting_product_hold: recentOot.filter((o) => o.productHoldRequired && !o.productHoldRef).length,
      recent: recentOot.map((o) => ({
        id: o.id,
        status: o.status,
        disposition: o.disposition,
        event_no: o.event?.eventNo ?? null,
        instrument_code: o.event?.instrument?.code ?? null,
        instrument_name: o.event?.instrument?.name ?? null,
        window_days: Math.max(0, Math.round((o.impactWindowTo.getTime() - o.impactWindowFrom.getTime()) / 86_400_000)),
        affected_total: o.affectedResultIds.length + o.affectedSampleIds.length + o.affectedBatchRefs.length,
      })),
    },

    checks: {
      enabled: cfg.enableInUseChecks,
      monitored_instruments: monitored.length,
      due_now: checksDue,
      failed_7d: checksFailed,
      holds_unreferenced: holdsOpen,
      recent: checksRecent.map((c) => ({
        id: c.id,
        instrument_code: c.instrument?.code ?? null,
        instrument_name: c.instrument?.name ?? null,
        performed_at: c.performedAt,
        shift: c.shift,
        outcome: c.outcome,
        batch_ref: c.batchRef,
        hold_triggered: c.holdTriggered,
      })),
    },

    standards: {
      total: standards.length,
      lapsed: lapsedStandards.length,
      expiring_60: expiringStandards.length,
      items: [...lapsedStandards, ...expiringStandards].slice(0, 6).map((s) => ({
        instrument_id: s.id,
        code: s.code,
        name: s.name,
        due_at: s.calibrationDueAt,
        is_lapsed: !!s.calibrationDueAt && s.calibrationDueAt < now,
      })),
    },

    msa: {
      enabled: cfg.enableMsa,
      total: msaAll.length,
      acceptable: msaAll.filter((m) => m.verdict === 'ACCEPTABLE').length,
      conditional: msaAll.filter((m) => m.verdict === 'CONDITIONAL').length,
      unacceptable: msaAll.filter((m) => m.verdict === 'UNACCEPTABLE').length,
      not_computed: msaAll.filter((m) => !m.verdict).length,
      awaiting_approval: msaAll.filter((m) => m.verdict && !m.approvedAt).length,
      recent: msaAll.slice(0, 5).map((m) => ({
        id: m.id,
        study_no: m.studyNo,
        instrument_code: m.instrument?.code ?? null,
        verdict: m.verdict,
        grr_percent: num(m.grrPercent),
        approved: !!m.approvedAt,
      })),
    },

    providers: {
      total: providers.length,
      active: providers.filter((p) => p.isActive).length,
      accreditation_lapsed: lapsedProviders.length,
      accreditation_expiring_60: expiringProviders.length,
      items: [...lapsedProviders, ...expiringProviders].slice(0, 5).map((p) => ({
        provider_id: p.id,
        code: p.code,
        name: p.name,
        expires: p.accreditationExpiry,
        is_lapsed: !!p.accreditationExpiry && p.accreditationExpiry < now,
      })),
    },

    categories: {
      total: categoryStats.length,
      active: categoryStats.filter((c) => c.isActive).length,
      in_use: categoryStats.filter((c) => c._count.instruments > 0).length,
      requiring_msa: categoryStats.filter((c) => c.requiresMsa).length,
      requiring_checks: categoryStats.filter((c) => c.requiresInUseCheck).length,
    },
  };
};
