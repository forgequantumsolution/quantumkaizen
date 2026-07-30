/**
 * Calibration plans — the schedule, and the tolerances an instrument is judged
 * against.
 *
 * Plans are versioned and never edited in place. Editing a plan would silently
 * rewrite the criteria a three-year-old certificate was issued under, which is
 * precisely the data-integrity failure MHRA cites. `update` supersedes: the old
 * version is deactivated and kept, a new one is created.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { trail } from './integrations';
import { TX_OPTIONS, computeLimits, computeNextDue, num, resolveConfig } from './calibration.lib';
import { materializePoints } from './config.service';
import type { PlanUpsertInput } from './calibration.schema';

type PlanRow = Prisma.CalibrationPlanGetPayload<{ include: { points: true } }>;

export const serializePlan = (p: PlanRow) => ({
  id: p.id,
  instrument_id: p.instrumentId,
  version: p.version,
  is_active: p.isActive,
  interval_type: p.intervalType,
  interval_value: p.intervalValue,
  interval_justification: p.intervalJustification,
  method_doc_id: p.methodDocId,
  method_ref: p.methodRef,
  provider_type: p.providerType,
  provider_id: p.providerId,
  estimated_duration_hours: num(p.estimatedDurationHours),
  requires_msa: p.requiresMsa,
  required_course_id: p.requiredCourseId,
  required_standard_category_ids: p.requiredStandardCategoryIds,
  next_due_at: p.nextDueAt,
  last_event_id: p.lastEventId,
  superseded_by_id: p.supersededById,
  points: [...p.points]
    .sort((a, b) => a.sequence - b.sequence)
    .map((pt) => ({
      id: pt.id,
      sequence: pt.sequence,
      label: pt.label,
      nominal_value: num(pt.nominalValue),
      unit_code: pt.unitCode,
      tolerance_type: pt.toleranceType,
      tolerance_value: num(pt.toleranceValue),
      lower_limit: num(pt.lowerLimit),
      upper_limit: num(pt.upperLimit),
    })),
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

const parseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const loadInstrument = async (instrumentId: string) => {
  const e = await prisma.calibrationInstrument.findFirst({
    where: { id: instrumentId, isDeleted: false },
    include: { category: { select: { id: true, requiresMsa: true, defaultIntervalDays: true } } },
  });
  if (!e) throw NotFound('Instrument not found');
  return e;
};

/** Recompute stored limits from the submitted points, against this instrument. */
const buildPoints = (
  points: PlanUpsertInput['points'],
  instrument: { measurementRangeMin: Prisma.Decimal | null; measurementRangeMax: Prisma.Decimal | null; mpe: Prisma.Decimal | null },
) => {
  const seqs = new Set(points.map((p) => p.sequence));
  if (seqs.size !== points.length) throw BadRequest('Point sequences must be unique');

  return points.map((p) => {
    const limits = computeLimits({
      nominalValue: p.nominal_value,
      toleranceType: p.tolerance_type,
      toleranceValue: p.tolerance_value,
      spanMin: num(instrument.measurementRangeMin),
      spanMax: num(instrument.measurementRangeMax),
      mpe: num(instrument.mpe),
    });
    if (limits.halfWidth === 0 && p.tolerance_value !== 0) {
      throw BadRequest(`Point "${p.label}" resolves to a zero-width tolerance — check the instrument range and MPE`);
    }
    return {
      sequence: p.sequence,
      label: p.label,
      nominalValue: p.nominal_value,
      unitCode: p.unit_code ?? null,
      toleranceType: p.tolerance_type,
      toleranceValue: p.tolerance_value,
      lowerLimit: limits.lowerLimit,
      upperLimit: limits.upperLimit,
    };
  });
};

/**
 * MSA gate (IATF §7.1.5.1.1): a category flagged `requiresMsa` cannot have an
 * active plan until an acceptable study exists. Enforcing it at plan activation
 * is the only point where it actually stops a bad gauge reaching the line.
 */
const assertMsaSatisfied = async (instrumentId: string, requiresMsa: boolean, siteId: string | null) => {
  if (!requiresMsa) return;
  const cfg = await resolveConfig(siteId);
  if (!cfg.enableMsa) return; // capability off for this site — gate is not applicable

  const study = await prisma.msaStudy.findFirst({
    where: { instrumentId, isDeleted: false, verdict: { in: ['ACCEPTABLE', 'CONDITIONAL'] } },
    orderBy: { performedAt: 'desc' },
    select: { id: true, verdict: true },
  });
  if (!study) {
    throw BadRequest(
      'This instrument category requires a measurement systems analysis (Gage R&R) with an acceptable verdict before a calibration plan can be activated',
    );
  }
};

export const listPlans = async (instrumentId: string) => {
  const rows = await prisma.calibrationPlan.findMany({
    where: { instrumentId, isDeleted: false },
    include: { points: true },
    orderBy: { version: 'desc' },
  });
  return { data: rows.map(serializePlan), total: rows.length };
};

export const getPlan = async (id: string) => {
  const p = await prisma.calibrationPlan.findFirst({ where: { id, isDeleted: false }, include: { points: true } });
  if (!p) throw NotFound('Calibration plan not found');
  return serializePlan(p);
};

export const createPlan = async (instrumentId: string, input: PlanUpsertInput, userId?: string) => {
  const instrument = await loadInstrument(instrumentId);
  if (!instrument.isCalibrationRequired) {
    throw BadRequest('This instrument is exempt from calibration — remove the exemption before creating a plan');
  }

  const active = await prisma.calibrationPlan.findFirst({
    where: { instrumentId, isActive: true, isDeleted: false },
    select: { id: true, version: true },
  });
  if (active) throw Conflict('An active plan already exists — update it to create a new version');

  const requiresMsa = input.requires_msa ?? instrument.category?.requiresMsa ?? false;
  await assertMsaSatisfied(instrumentId, requiresMsa, instrument.siteId);

  const points = buildPoints(input.points, instrument);
  const cfg = await resolveConfig(instrument.siteId);
  const nextDue =
    parseDate(input.next_due_at) ??
    computeNextDue({
      intervalType: input.interval_type,
      intervalValue: input.interval_value,
      performedAt: instrument.lastCalibratedAt ?? new Date(),
      previousDueAt: instrument.calibrationDueAt,
      basis: cfg.intervalResetBasis,
    });

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.calibrationPlan.create({
      data: {
        instrumentId,
        version: 1,
        isActive: true,
        intervalType: input.interval_type,
        intervalValue: input.interval_value,
        intervalJustification: input.interval_justification ?? null,
        methodDocId: input.method_doc_id ?? null,
        methodRef: input.method_ref ?? null,
        providerType: input.provider_type,
        providerId: input.provider_id ?? null,
        estimatedDurationHours: input.estimated_duration_hours ?? null,
        requiresMsa,
        requiredCourseId: input.required_course_id ?? null,
        requiredStandardCategoryIds: input.required_standard_category_ids ?? [],
        nextDueAt: nextDue,
        createdById: userId ?? null,
        points: { create: points },
      },
      include: { points: true },
    });

    // The plan owns the schedule, so the instrument's due date follows it.
    await tx.calibrationInstrument.update({
      where: { id: instrumentId },
      data: {
        calibrationDueAt: nextDue,
      },
    });
    return plan;
  }, TX_OPTIONS);

  await trail(
    {
      entityType: 'CalibrationPlan',
      entityId: created.id,
      action: 'CREATE',
      newValue: `v1 — every ${input.interval_value} ${input.interval_type.toLowerCase()}, ${points.length} point(s)`,
      reason: input.interval_justification ?? null,
    },
    userId,
  );
  return serializePlan(created);
};

/**
 * Supersede: deactivate the current version, create the next one.
 * Never mutates the version a past certificate was issued under.
 */
export const supersedePlan = async (planId: string, input: PlanUpsertInput, userId?: string) => {
  const current = await prisma.calibrationPlan.findFirst({
    where: { id: planId, isDeleted: false },
    include: { points: true },
  });
  if (!current) throw NotFound('Calibration plan not found');

  const instrument = await loadInstrument(current.instrumentId);
  const cfg = await resolveConfig(instrument.siteId);
  if (cfg.requireReasonForChange && !input.change_reason) {
    throw BadRequest('A reason for change is required by this site\'s calibration configuration');
  }

  const requiresMsa = input.requires_msa ?? current.requiresMsa;
  await assertMsaSatisfied(current.instrumentId, requiresMsa, instrument.siteId);

  const points = buildPoints(input.points, instrument);
  const nextDue =
    parseDate(input.next_due_at) ??
    current.nextDueAt ??
    computeNextDue({
      intervalType: input.interval_type,
      intervalValue: input.interval_value,
      performedAt: instrument.lastCalibratedAt ?? new Date(),
      previousDueAt: instrument.calibrationDueAt,
      basis: cfg.intervalResetBasis,
    });

  const maxVersion = await prisma.calibrationPlan.aggregate({
    where: { instrumentId: current.instrumentId },
    _max: { version: true },
  });
  const nextVersion = (maxVersion._max.version ?? current.version) + 1;

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.calibrationPlan.create({
      data: {
        instrumentId: current.instrumentId,
        version: nextVersion,
        isActive: true,
        intervalType: input.interval_type,
        intervalValue: input.interval_value,
        intervalJustification: input.interval_justification ?? null,
        methodDocId: input.method_doc_id ?? null,
        methodRef: input.method_ref ?? null,
        providerType: input.provider_type,
        providerId: input.provider_id ?? null,
        estimatedDurationHours: input.estimated_duration_hours ?? null,
        requiresMsa,
        requiredCourseId: input.required_course_id ?? null,
        requiredStandardCategoryIds: input.required_standard_category_ids ?? [],
        nextDueAt: nextDue,
        createdById: userId ?? null,
        points: { create: points },
      },
      include: { points: true },
    });

    await tx.calibrationPlan.update({
      where: { id: current.id },
      data: { isActive: false, supersededById: plan.id },
    });
    await tx.calibrationInstrument.update({ where: { id: current.instrumentId }, data: { calibrationDueAt: nextDue } });
    return plan;
  }, TX_OPTIONS);

  await trail(
    {
      entityType: 'CalibrationPlan',
      entityId: created.id,
      action: 'UPDATE',
      field: 'version',
      oldValue: `v${current.version}`,
      newValue: `v${nextVersion}`,
      reason: input.change_reason ?? 'Plan superseded',
    },
    userId,
  );
  return serializePlan(created);
};

export const deactivatePlan = async (planId: string, reason: string, userId?: string) => {
  const plan = await prisma.calibrationPlan.findFirst({ where: { id: planId, isDeleted: false } });
  if (!plan) throw NotFound('Calibration plan not found');
  if (!plan.isActive) throw BadRequest('Plan is already inactive');

  await prisma.calibrationPlan.update({ where: { id: planId }, data: { isActive: false } });
  await trail(
    { entityType: 'CalibrationPlan', entityId: planId, action: 'UPDATE', field: 'isActive', oldValue: 'true', newValue: 'false', reason },
    userId,
  );
  return { id: planId, is_active: false };
};

/**
 * Suggest a plan from the instrument's category template — the "don't type 40
 * tolerance values by hand" path that makes the industry packs pay off.
 */
export const suggestPlanFromCategory = async (instrumentId: string) => {
  const instrument = await loadInstrument(instrumentId);
  if (!instrument.categoryId) {
    return { available: false as const, reason: 'Instrument has no category assigned', points: [] };
  }

  const templates = await prisma.calibrationPointTemplate.findMany({
    where: { categoryId: instrument.categoryId },
    orderBy: { sequence: 'asc' },
  });
  if (!templates.length) {
    return { available: false as const, reason: 'Category has no point templates', points: [] };
  }

  const cat = await prisma.equipmentCategory.findUnique({ where: { id: instrument.categoryId } });
  const points = materializePoints(templates, instrument);

  return {
    available: true as const,
    reason: null,
    category_name: cat?.name ?? null,
    interval_type: 'DAYS' as const,
    interval_value: cat?.defaultIntervalDays ?? 365,
    requires_msa: cat?.requiresMsa ?? false,
    points: points.map((p) => ({
      sequence: p.sequence,
      label: p.label,
      nominal_value: p.nominalValue,
      unit_code: p.unitCode,
      tolerance_type: p.toleranceType,
      tolerance_value: p.toleranceValue,
      lower_limit: p.lowerLimit,
      upper_limit: p.upperLimit,
    })),
  };
};
