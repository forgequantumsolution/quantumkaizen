/**
 * Calibration sweeps — the clock-driven half of the module.
 *
 * `refreshCalibrationStatus` is the ONLY writer of
 * `CalibrationInstrument.calibrationStatus` for time-based transitions; the
 * event lifecycle owns the rest. Two writers of a derived status is how a
 * registry ends up disagreeing with itself.
 */
import { prisma } from '../../lib/prisma';
import { addDays, deriveCalibrationStatus, resolveConfig } from './calibration.lib';
import { trail } from './integrations';

/**
 * Recompute every instrument's calibration status from its due date.
 *
 * Config is resolved per site, so a two-site tenant running different packs
 * gets different due-soon windows — which is the point of per-site config.
 */
export const refreshCalibrationStatus = async () => {
  const instruments = await prisma.calibrationInstrument.findMany({
    where: { isDeleted: false, status: { not: 'RETIRED' } },
    select: {
      id: true,
      code: true,
      siteId: true,
      status: true,
      calibrationStatus: true,
      calibrationDueAt: true,
      isCalibrationRequired: true,
    },
  });

  // One config lookup per distinct site rather than per instrument.
  const siteIds = [...new Set(instruments.map((i) => i.siteId))];
  const configs = new Map(
    await Promise.all(siteIds.map(async (s) => [s, await resolveConfig(s)] as const)),
  );

  let changed = 0;
  const transitions: Record<string, number> = {};

  for (const i of instruments) {
    const cfg = configs.get(i.siteId);
    if (!cfg) continue;

    const next = deriveCalibrationStatus({
      isCalibrationRequired: i.isCalibrationRequired,
      instrumentStatus: i.status,
      current: i.calibrationStatus,
      nextDueAt: i.calibrationDueAt,
      dueSoonWindowDays: cfg.dueSoonWindowDays,
      graceDays: cfg.graceDays,
    });

    if (next === i.calibrationStatus) continue;

    await prisma.calibrationInstrument.update({ where: { id: i.id }, data: { calibrationStatus: next } });
    changed += 1;
    const key = `${i.calibrationStatus}→${next}`;
    transitions[key] = (transitions[key] ?? 0) + 1;

    // Only the transition INTO overdue is worth a trail entry — a nightly
    // "still overdue" line would bury the audit trail in noise.
    if (next === 'OVERDUE') {
      await trail({
        entityType: 'CalibrationInstrument',
        entityId: i.id,
        action: 'UPDATE',
        field: 'calibrationStatus',
        oldValue: i.calibrationStatus,
        newValue: 'OVERDUE',
        reason: `Calibration due ${i.calibrationDueAt?.toISOString() ?? 'unknown'} has passed`,
      });
    }
  }

  return { scanned: instruments.length, changed, transitions };
};

/**
 * Create the calibration record ahead of its due date, so the work is visible
 * before it is late. Idempotent on (planId, scheduledFor).
 */
export const spawnDueCalibrations = async () => {
  const plans = await prisma.calibrationPlan.findMany({
    where: { isActive: true, isDeleted: false, nextDueAt: { not: null } },
    include: {
      instrument: { select: { id: true, code: true, siteId: true, status: true, isCalibrationRequired: true } },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const plan of plans) {
    const inst = plan.instrument;
    if (!inst || inst.status === 'RETIRED' || !inst.isCalibrationRequired) {
      skipped += 1;
      continue;
    }

    const cfg = await resolveConfig(inst.siteId);
    const leadDate = addDays(new Date(), cfg.autoSpawnLeadDays);
    if (!plan.nextDueAt || plan.nextDueAt > leadDate) continue;

    // Anything already open for this instrument means the work is in hand.
    const open = await prisma.calibrationEvent.findFirst({
      where: {
        instrumentId: inst.id,
        isDeleted: false,
        status: { in: ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_REVIEW', 'PENDING_APPROVAL'] },
      },
      select: { id: true },
    });
    if (open) {
      skipped += 1;
      continue;
    }

    const points = await prisma.calibrationPoint.findMany({
      where: { planId: plan.id },
      orderBy: { sequence: 'asc' },
    });
    if (points.length === 0) {
      skipped += 1;
      continue;
    }

    const year = plan.nextDueAt.getFullYear();
    const head = `${cfg.eventNumberPrefix}-${year}-`;
    const existing = await prisma.calibrationEvent.findMany({
      where: { eventNo: { startsWith: head } },
      select: { eventNo: true },
    });
    const max = existing.reduce((acc, e) => {
      const n = Number(e.eventNo.slice(head.length));
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 0);
    const eventNo = `${head}${String(max + 1).padStart(5, '0')}`;

    await prisma.calibrationEvent.create({
      data: {
        eventNo,
        instrumentId: inst.id,
        planId: plan.id,
        planVersion: plan.version,
        type: 'PERIODIC',
        status: 'SCHEDULED',
        siteId: inst.siteId,
        scheduledFor: plan.nextDueAt,
        providerType: plan.providerType,
        providerId: plan.providerId,
        readings: {
          create: points.map((p) => ({
            sequence: p.sequence,
            label: p.label,
            nominalValue: p.nominalValue,
            unitCode: p.unitCode,
            lowerLimit: p.lowerLimit,
            upperLimit: p.upperLimit,
          })),
        },
      },
    });
    created += 1;
  }

  return { plans: plans.length, created, skipped };
};

/**
 * Reference standards past their own due date, and providers whose ISO/IEC
 * 17025 accreditation is lapsing.
 *
 * A lapsed standard retroactively weakens every calibration it backed, so this
 * also counts the affected records rather than only naming the standard.
 */
export const flagLapsedStandards = async () => {
  const now = new Date();

  const lapsed = await prisma.calibrationInstrument.findMany({
    where: {
      isDeleted: false,
      kind: 'REFERENCE_STANDARD',
      status: { not: 'RETIRED' },
      calibrationDueAt: { lt: now },
    },
    select: { id: true, code: true, calibrationDueAt: true },
  });

  const affected: { standard: string; usedInEvents: number }[] = [];
  for (const s of lapsed) {
    const count = await prisma.calibrationStandardUse.count({
      where: { standardInstrumentId: s.id, event: { performedAt: { gte: s.calibrationDueAt ?? now } } },
    });
    if (count > 0) affected.push({ standard: s.code, usedInEvents: count });
  }

  const expiringProviders = await prisma.calibrationProvider.findMany({
    where: { isDeleted: false, isActive: true, accreditationExpiry: { not: null, lte: addDays(now, 60) } },
    select: { code: true, name: true, accreditationExpiry: true },
  });

  return {
    lapsed_standards: lapsed.length,
    standards_used_after_lapse: affected,
    providers_expiring: expiringProviders.map((p) => ({
      code: p.code,
      name: p.name,
      expires: p.accreditationExpiry,
    })),
  };
};

/**
 * Instruments whose in-use verification is overdue for the current window.
 * This is the FMCG daily control — a missed shift check is itself a finding.
 */
export const flagMissedInUseChecks = async () => {
  const instruments = await prisma.calibrationInstrument.findMany({
    where: {
      isDeleted: false,
      status: 'ACTIVE',
      category: { requiresInUseCheck: true, isDeleted: false },
    },
    include: {
      category: { select: { inUseCheckFrequency: true } },
      inUseChecks: { orderBy: { performedAt: 'desc' }, take: 1, select: { performedAt: true } },
    },
  });

  const now = new Date();
  const hoursFor = (freq: string | null): number => {
    switch (freq) {
      case 'PER_SHIFT':
        return 8;
      case 'DAILY':
        return 24;
      case 'WEEKLY':
        return 168;
      case 'MONTHLY':
        return 720;
      default:
        return 8;
    }
  };

  const missed = instruments.filter((i) => {
    const last = i.inUseChecks[0];
    if (!last) return true;
    const limit = hoursFor(i.category?.inUseCheckFrequency ?? null) * 3_600_000;
    return now.getTime() - last.performedAt.getTime() > limit;
  });

  return {
    monitored: instruments.length,
    missed: missed.length,
    instruments: missed.map((i) => ({
      id: i.id,
      code: i.code,
      frequency: i.category?.inUseCheckFrequency ?? null,
      last_check_at: i.inUseChecks[0]?.performedAt ?? null,
    })),
  };
};

/** Every calibration sweep, for the worker tick and the ad-hoc CLI. */
export const runAllCalibrationSweeps = async () => {
  const status = await refreshCalibrationStatus();
  const spawned = await spawnDueCalibrations();
  const standards = await flagLapsedStandards();
  const checks = await flagMissedInUseChecks();
  return { status, spawned, standards, checks };
};
