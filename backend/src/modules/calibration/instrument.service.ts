/**
 * Instrument registry — the Calibration module's OWN table.
 *
 * `CalibrationInstrument` is not LIMS's `Equipment`. This module deploys,
 * migrates and runs on its own; a LIMS schema change cannot break a calibration
 * record, and a tenant with no LIMS at all still gets a complete instrument
 * registry. Where a tenant does run both, `limsEquipmentId` is a soft link (no
 * foreign key) that lets the out-of-tolerance impact scan reach LIMS results —
 * see integrations.ts, the only file allowed to look across that line.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import {
  addDays,
  daysUntil,
  deriveCalibrationStatus,
  isBlocked,
  makeQrToken,
  nextInstrumentCode,
  num,
  resolveConfig,
} from './calibration.lib';
import { resolveNames, searchLimsEquipment, trail } from './integrations';
import type { InstrumentUpsertInput, ListInstrumentsQuery, ReasonInput } from './calibration.schema';

const parseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const INCLUDE = {
  category: {
    select: {
      id: true,
      code: true,
      name: true,
      requiresMsa: true,
      requiresInUseCheck: true,
      inUseCheckFrequency: true,
    },
  },
} satisfies Prisma.CalibrationInstrumentInclude;

type Row = Prisma.CalibrationInstrumentGetPayload<{ include: typeof INCLUDE }>;

interface NameMaps {
  sites: Map<string, string>;
  departments: Map<string, string>;
  users: Map<string, string>;
}

const EMPTY_NAMES: NameMaps = { sites: new Map(), departments: new Map(), users: new Map() };

export const serializeInstrument = (e: Row, names: NameMaps = EMPTY_NAMES) => ({
  id: e.id,
  code: e.code,
  name: e.name,
  kind: e.kind,
  status: e.status,
  calibration_status: e.calibrationStatus,
  criticality: e.criticality,
  category_id: e.categoryId,
  category_name: e.category?.name ?? null,
  category_code: e.category?.code ?? null,
  requires_msa: e.category?.requiresMsa ?? false,
  requires_in_use_check: e.category?.requiresInUseCheck ?? false,
  in_use_check_frequency: e.category?.inUseCheckFrequency ?? null,
  site_id: e.siteId,
  site_name: e.siteId ? names.sites.get(e.siteId) ?? null : null,
  department_id: e.departmentId,
  department_name: e.departmentId ? names.departments.get(e.departmentId) ?? null : null,
  custodian_id: e.custodianId,
  custodian_name: e.custodianId ? names.users.get(e.custodianId) ?? null : null,
  lab_ref: e.labRef,
  lims_equipment_id: e.limsEquipmentId,
  serial_no: e.serialNo,
  manufacturer: e.manufacturer,
  model: e.model,
  location: e.location,
  asset_tag: e.assetTag,
  qr_token: e.qrToken,
  is_calibration_required: e.isCalibrationRequired,
  exemption_reason: e.exemptionReason,
  measurement_range_min: num(e.measurementRangeMin),
  measurement_range_max: num(e.measurementRangeMax),
  unit_code: e.unitCode,
  resolution: num(e.resolution),
  accuracy_class: e.accuracyClass,
  mpe: num(e.mpe),
  qualification_state: e.qualificationState,
  aiq_group: e.aiqGroup,
  gamp_category: e.gampCategory,
  legal_metrology_stamp_no: e.legalMetrologyStampNo,
  legal_metrology_valid_until: e.legalMetrologyValidUntil,
  last_calibrated_at: e.lastCalibratedAt,
  calibration_due_at: e.calibrationDueAt,
  days_until_due: daysUntil(e.calibrationDueAt),
  received_at: e.receivedAt,
  warranty_until: e.warrantyUntil,
  retired_at: e.retiredAt,
  retirement_reason: e.retirementReason,
  created_at: e.createdAt,
  updated_at: e.updatedAt,
});

const namesFor = (rows: Row[]) =>
  resolveNames({
    siteIds: rows.map((r) => r.siteId),
    departmentIds: rows.map((r) => r.departmentId),
    userIds: rows.map((r) => r.custodianId),
  });

// ─────────────────────────── List / get ───────────────────────────

export const listInstruments = async (q: ListInstrumentsQuery) => {
  const where: Prisma.CalibrationInstrumentWhereInput = { isDeleted: false };
  if (!q.include_retired) where.status = { not: 'RETIRED' };
  if (q.kind) where.kind = q.kind;
  if (q.criticality) where.criticality = q.criticality;
  if (q.category_id) where.categoryId = q.category_id;
  if (q.site_id) where.siteId = q.site_id;
  if (q.department_id) where.departmentId = q.department_id;
  if (q.custodian_id) where.custodianId = q.custodian_id;

  if (q.calibration_status) {
    const list = q.calibration_status
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean) as Prisma.EnumCalibrationStatusFilter['in'];
    if (list && (list as string[]).length) where.calibrationStatus = { in: list };
  }
  if (q.due_within !== undefined) {
    where.calibrationDueAt = { lte: addDays(new Date(), q.due_within) };
  }
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { serialNo: { contains: q.search, mode: 'insensitive' } },
      { assetTag: { contains: q.search, mode: 'insensitive' } },
      { location: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.calibrationInstrument.count({ where }),
    prisma.calibrationInstrument.findMany({
      where,
      include: INCLUDE,
      // Nearest due first — the registry should open on what needs doing.
      orderBy: [{ calibrationDueAt: { sort: 'asc', nulls: 'last' } }, { code: 'asc' }],
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);

  const names = await namesFor(rows);
  return {
    data: rows.map((r) => serializeInstrument(r, names)),
    total,
    page: q.page,
    page_size: q.page_size,
  };
};

export const getInstrument = async (id: string) => {
  const e = await prisma.calibrationInstrument.findFirst({ where: { id, isDeleted: false }, include: INCLUDE });
  if (!e) throw NotFound('Instrument not found');

  const [activePlan, lastEvent, openEvent, ootOpen, checkCount, names] = await Promise.all([
    prisma.calibrationPlan.findFirst({
      where: { instrumentId: id, isActive: true, isDeleted: false },
      include: { points: { orderBy: { sequence: 'asc' } } },
    }),
    prisma.calibrationEvent.findFirst({
      where: { instrumentId: id, isDeleted: false, status: 'APPROVED' },
      orderBy: { performedAt: 'desc' },
      select: {
        id: true,
        eventNo: true,
        performedAt: true,
        overallOutcome: true,
        asFoundOutcome: true,
        certificateNo: true,
        nextDueAt: true,
      },
    }),
    prisma.calibrationEvent.findFirst({
      where: {
        instrumentId: id,
        isDeleted: false,
        status: { in: ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_REVIEW', 'PENDING_APPROVAL'] },
      },
      orderBy: { scheduledFor: 'asc' },
      select: { id: true, eventNo: true, status: true, scheduledFor: true },
    }),
    prisma.outOfToleranceAssessment.count({
      where: { isDeleted: false, status: { not: 'CLOSED' }, event: { instrumentId: id } },
    }),
    prisma.inUseVerification.count({ where: { instrumentId: id, isDeleted: false } }),
    namesFor([e]),
  ]);

  const cfg = await resolveConfig(e.siteId);

  return {
    ...serializeInstrument(e, names),
    blocked_for_use: isBlocked(e.calibrationStatus, cfg),
    open_oot_count: ootOpen,
    in_use_check_count: checkCount,
    active_plan: activePlan
      ? {
          id: activePlan.id,
          version: activePlan.version,
          interval_type: activePlan.intervalType,
          interval_value: activePlan.intervalValue,
          provider_type: activePlan.providerType,
          provider_id: activePlan.providerId,
          next_due_at: activePlan.nextDueAt,
          requires_msa: activePlan.requiresMsa,
          point_count: activePlan.points.length,
        }
      : null,
    last_event: lastEvent
      ? {
          id: lastEvent.id,
          event_no: lastEvent.eventNo,
          performed_at: lastEvent.performedAt,
          as_found_outcome: lastEvent.asFoundOutcome,
          overall_outcome: lastEvent.overallOutcome,
          certificate_no: lastEvent.certificateNo,
          next_due_at: lastEvent.nextDueAt,
        }
      : null,
    open_event: openEvent
      ? {
          id: openEvent.id,
          event_no: openEvent.eventNo,
          status: openEvent.status,
          scheduled_for: openEvent.scheduledFor,
        }
      : null,
  };
};

// ─────────────────────────── Create / update ───────────────────────────

const applyCategoryDefaults = async (input: InstrumentUpsertInput) => {
  if (!input.category_id) return {};
  const cat = await prisma.equipmentCategory.findFirst({ where: { id: input.category_id, isDeleted: false } });
  if (!cat) throw BadRequest('Category not found');
  return { kind: input.kind ?? cat.kind, criticality: input.criticality ?? cat.defaultCriticality };
};

export const createInstrument = async (input: InstrumentUpsertInput, userId?: string) => {
  const code = input.code?.trim() || (await nextInstrumentCode());
  const clash = await prisma.calibrationInstrument.findUnique({ where: { code } });
  if (clash) throw Conflict(`Instrument code "${code}" already exists`);

  if (input.is_calibration_required === false && !input.exemption_reason) {
    throw BadRequest('An exemption reason is required when calibration is not required');
  }

  const defaults = await applyCategoryDefaults(input);

  const created = await prisma.calibrationInstrument.create({
    data: {
      code,
      name: input.name,
      kind: defaults.kind ?? input.kind ?? 'LAB_INSTRUMENT',
      categoryId: input.category_id ?? null,
      siteId: input.site_id ?? null,
      departmentId: input.department_id ?? null,
      custodianId: input.custodian_id ?? null,
      labRef: input.lab_ref ?? null,
      limsEquipmentId: input.lims_equipment_id ?? null,
      serialNo: input.serial_no ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      location: input.location ?? null,
      assetTag: input.asset_tag ?? null,
      criticality: defaults.criticality ?? input.criticality ?? 'MAJOR',
      isCalibrationRequired: input.is_calibration_required ?? true,
      exemptionReason: input.exemption_reason ?? null,
      calibrationStatus: input.is_calibration_required === false ? 'NOT_REQUIRED' : 'CALIBRATED',
      measurementRangeMin: input.measurement_range_min ?? null,
      measurementRangeMax: input.measurement_range_max ?? null,
      unitCode: input.unit_code ?? null,
      resolution: input.resolution ?? null,
      accuracyClass: input.accuracy_class ?? null,
      mpe: input.mpe ?? null,
      qualificationState: input.qualification_state ?? 'NOT_STARTED',
      aiqGroup: input.aiq_group ?? null,
      gampCategory: input.gamp_category ?? null,
      receivedAt: parseDate(input.received_at),
      warrantyUntil: parseDate(input.warranty_until),
      legalMetrologyStampNo: input.legal_metrology_stamp_no ?? null,
      legalMetrologyValidUntil: parseDate(input.legal_metrology_valid_until),
      qrToken: makeQrToken(),
      createdById: userId ?? null,
    },
    include: INCLUDE,
  });

  await trail(
    {
      entityType: 'CalibrationInstrument',
      entityId: created.id,
      action: 'CREATE',
      newValue: `${created.code} — ${created.name}`,
    },
    userId,
  );
  return serializeInstrument(created, await namesFor([created]));
};

export const updateInstrument = async (id: string, input: InstrumentUpsertInput, userId?: string) => {
  const existing = await prisma.calibrationInstrument.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Instrument not found');

  if (input.is_calibration_required === false && !input.exemption_reason) {
    throw BadRequest('An exemption reason is required when calibration is not required');
  }

  let updated = await prisma.calibrationInstrument.update({
    where: { id },
    data: {
      name: input.name,
      kind: input.kind ?? existing.kind,
      categoryId: input.category_id ?? null,
      siteId: input.site_id ?? null,
      departmentId: input.department_id ?? null,
      custodianId: input.custodian_id ?? null,
      labRef: input.lab_ref ?? null,
      limsEquipmentId: input.lims_equipment_id ?? null,
      serialNo: input.serial_no ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      location: input.location ?? null,
      assetTag: input.asset_tag ?? null,
      criticality: input.criticality ?? existing.criticality,
      isCalibrationRequired: input.is_calibration_required ?? existing.isCalibrationRequired,
      exemptionReason: input.exemption_reason ?? null,
      measurementRangeMin: input.measurement_range_min ?? null,
      measurementRangeMax: input.measurement_range_max ?? null,
      unitCode: input.unit_code ?? null,
      resolution: input.resolution ?? null,
      accuracyClass: input.accuracy_class ?? null,
      mpe: input.mpe ?? null,
      qualificationState: input.qualification_state ?? existing.qualificationState,
      aiqGroup: input.aiq_group ?? null,
      gampCategory: input.gamp_category ?? null,
      receivedAt: parseDate(input.received_at),
      warrantyUntil: parseDate(input.warranty_until),
      legalMetrologyStampNo: input.legal_metrology_stamp_no ?? null,
      legalMetrologyValidUntil: parseDate(input.legal_metrology_valid_until),
      qrToken: existing.qrToken ?? makeQrToken(),
    },
    include: INCLUDE,
  });

  const cfg = await resolveConfig(updated.siteId);
  const next = deriveCalibrationStatus({
    isCalibrationRequired: updated.isCalibrationRequired,
    instrumentStatus: updated.status,
    current: updated.calibrationStatus,
    nextDueAt: updated.calibrationDueAt,
    dueSoonWindowDays: cfg.dueSoonWindowDays,
    graceDays: cfg.graceDays,
  });
  if (next !== updated.calibrationStatus) {
    updated = await prisma.calibrationInstrument.update({
      where: { id },
      data: { calibrationStatus: next },
      include: INCLUDE,
    });
  }

  await trail(
    { entityType: 'CalibrationInstrument', entityId: id, action: 'UPDATE', oldValue: existing.name, newValue: updated.name },
    userId,
  );
  return serializeInstrument(updated, await namesFor([updated]));
};

export const deleteInstrument = async (id: string, userId?: string) => {
  const existing = await prisma.calibrationInstrument.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Instrument not found');

  const events = await prisma.calibrationEvent.count({ where: { instrumentId: id, isDeleted: false } });
  if (events > 0) {
    throw Conflict(`${events} calibration record(s) exist — retire this instrument instead of deleting it`);
  }
  await prisma.calibrationInstrument.update({ where: { id }, data: { isDeleted: true } });
  await trail({ entityType: 'CalibrationInstrument', entityId: id, action: 'DELETE', oldValue: existing.code }, userId);
};

// ─────────────────────────── Lifecycle actions ───────────────────────────

export const retireInstrument = async (id: string, input: ReasonInput, userId?: string) => {
  const existing = await prisma.calibrationInstrument.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Instrument not found');
  if (existing.status === 'RETIRED') throw BadRequest('Instrument is already retired');

  const updated = await prisma.calibrationInstrument.update({
    where: { id },
    data: {
      status: 'RETIRED',
      calibrationStatus: 'NOT_REQUIRED',
      retiredAt: new Date(),
      retirementReason: input.reason,
    },
    include: INCLUDE,
  });

  // An instrument on its way out must not leave a live schedule behind.
  await prisma.calibrationPlan.updateMany({ where: { instrumentId: id, isActive: true }, data: { isActive: false } });
  await prisma.calibrationEvent.updateMany({
    where: { instrumentId: id, status: { in: ['PLANNED', 'SCHEDULED'] } },
    data: { status: 'CANCELLED', cancelReason: `Instrument retired: ${input.reason}` },
  });

  await trail(
    {
      entityType: 'CalibrationInstrument',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: existing.status,
      newValue: 'RETIRED',
      reason: input.reason,
    },
    userId,
  );
  return serializeInstrument(updated, await namesFor([updated]));
};

export const setOutOfService = async (id: string, input: ReasonInput, userId?: string) => {
  const existing = await prisma.calibrationInstrument.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Instrument not found');

  const updated = await prisma.calibrationInstrument.update({
    where: { id },
    data: { status: 'OUT_OF_SERVICE', calibrationStatus: 'OUT_OF_SERVICE' },
    include: INCLUDE,
  });
  await trail(
    {
      entityType: 'CalibrationInstrument',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: existing.status,
      newValue: 'OUT_OF_SERVICE',
      reason: input.reason,
    },
    userId,
  );
  return serializeInstrument(updated, await namesFor([updated]));
};

export const returnToService = async (id: string, input: ReasonInput, userId?: string) => {
  const existing = await prisma.calibrationInstrument.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Instrument not found');
  if (existing.status === 'RETIRED') throw BadRequest('A retired instrument cannot be returned to service');

  const cfg = await resolveConfig(existing.siteId);
  const status = deriveCalibrationStatus({
    isCalibrationRequired: existing.isCalibrationRequired,
    instrumentStatus: 'ACTIVE',
    // Clear the sticky terminal state so the clock governs again.
    current: 'CALIBRATED',
    nextDueAt: existing.calibrationDueAt,
    dueSoonWindowDays: cfg.dueSoonWindowDays,
    graceDays: cfg.graceDays,
  });

  const updated = await prisma.calibrationInstrument.update({
    where: { id },
    data: { status: 'ACTIVE', calibrationStatus: status },
    include: INCLUDE,
  });
  await trail(
    {
      entityType: 'CalibrationInstrument',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: existing.status,
      newValue: 'ACTIVE',
      reason: input.reason,
    },
    userId,
  );
  return serializeInstrument(updated, await namesFor([updated]));
};

export const exemptInstrument = async (id: string, input: ReasonInput, userId?: string) => {
  const existing = await prisma.calibrationInstrument.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Instrument not found');

  const updated = await prisma.calibrationInstrument.update({
    where: { id },
    data: { isCalibrationRequired: false, exemptionReason: input.reason, calibrationStatus: 'NOT_REQUIRED' },
    include: INCLUDE,
  });
  await trail(
    {
      entityType: 'CalibrationInstrument',
      entityId: id,
      action: 'UPDATE',
      field: 'isCalibrationRequired',
      oldValue: 'true',
      newValue: 'false',
      reason: input.reason,
    },
    userId,
  );
  return serializeInstrument(updated, await namesFor([updated]));
};

// ─────────────────────────── History, label, drift ───────────────────────────

export const getHistory = async (id: string) => {
  const e = await prisma.calibrationInstrument.findFirst({ where: { id, isDeleted: false }, select: { id: true } });
  if (!e) throw NotFound('Instrument not found');

  const [events, checks] = await Promise.all([
    prisma.calibrationEvent.findMany({
      where: { instrumentId: id, isDeleted: false },
      orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
      include: { oot: { select: { id: true, status: true, disposition: true } } },
    }),
    prisma.inUseVerification.findMany({
      where: { instrumentId: id, isDeleted: false },
      orderBy: { performedAt: 'desc' },
      take: 200,
    }),
  ]);

  return {
    events: events.map((ev) => ({
      id: ev.id,
      event_no: ev.eventNo,
      type: ev.type,
      status: ev.status,
      scheduled_for: ev.scheduledFor,
      performed_at: ev.performedAt,
      as_found_outcome: ev.asFoundOutcome,
      as_left_outcome: ev.asLeftOutcome,
      overall_outcome: ev.overallOutcome,
      certificate_no: ev.certificateNo,
      next_due_at: ev.nextDueAt,
      adjustment_made: ev.adjustmentMade,
      oot: ev.oot ? { id: ev.oot.id, status: ev.oot.status, disposition: ev.oot.disposition } : null,
    })),
    checks: checks.map((c) => ({
      id: c.id,
      performed_at: c.performedAt,
      shift: c.shift,
      outcome: c.outcome,
      batch_ref: c.batchRef,
      hold_triggered: c.holdTriggered,
      hold_ref: c.holdRef,
      readings: c.readings,
    })),
  };
};

/**
 * As-found error per calibration point over time.
 *
 * The interval-justification evidence: pharma's "why six months?" and IATF's
 * data-driven interval review are both answered from this series rather than
 * from an opinion.
 */
export const getDrift = async (id: string) => {
  const events = await prisma.calibrationEvent.findMany({
    where: { instrumentId: id, isDeleted: false, status: 'APPROVED', performedAt: { not: null } },
    orderBy: { performedAt: 'asc' },
    include: { readings: { orderBy: { sequence: 'asc' } } },
  });

  const seriesByLabel = new Map<
    string,
    { performed_at: Date | null; as_found_error: number | null; upper: number; lower: number }[]
  >();
  for (const ev of events) {
    for (const r of ev.readings) {
      const arr = seriesByLabel.get(r.label) ?? [];
      arr.push({
        performed_at: ev.performedAt,
        as_found_error: num(r.asFoundError),
        upper: num(r.upperLimit) ?? 0,
        lower: num(r.lowerLimit) ?? 0,
      });
      seriesByLabel.set(r.label, arr);
    }
  }

  const series = [...seriesByLabel.entries()].map(([label, points]) => {
    const errs = points.map((p) => p.as_found_error).filter((v): v is number => v !== null);
    const maxAbs = errs.length ? Math.max(...errs.map(Math.abs)) : null;

    // Least-squares slope in error-units per day. A rising slope against a
    // tightening tolerance is the argument for shortening the interval.
    let slopePerDay: number | null = null;
    const dated = points.filter((p) => p.performed_at && p.as_found_error !== null);
    if (dated.length >= 2) {
      const xs = dated.map((p) => p.performed_at!.getTime() / 86_400_000);
      const ys = dated.map((p) => p.as_found_error!);
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const denom = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
      slopePerDay =
        denom === 0
          ? null
          : Number((xs.reduce((a, x, i) => a + (x - mx) * (ys[i]! - my), 0) / denom).toFixed(9));
    }
    return { label, points, max_abs_error: maxAbs, slope_per_day: slopePerDay };
  });

  return { series, event_count: events.length };
};

/** Sticker payload — everything a printed label needs, nothing more. */
export const getLabel = async (id: string) => {
  const e = await prisma.calibrationInstrument.findFirst({ where: { id, isDeleted: false }, include: INCLUDE });
  if (!e) throw NotFound('Instrument not found');

  let token = e.qrToken;
  if (!token) {
    token = makeQrToken();
    await prisma.calibrationInstrument.update({ where: { id }, data: { qrToken: token } });
  }

  const lastEvent = await prisma.calibrationEvent.findFirst({
    where: { instrumentId: id, status: 'APPROVED', isDeleted: false },
    orderBy: { performedAt: 'desc' },
    select: { certificateNo: true, performedAt: true },
  });

  return {
    id: e.id,
    code: e.code,
    name: e.name,
    serial_no: e.serialNo,
    asset_tag: e.assetTag,
    location: e.location,
    calibration_status: e.calibrationStatus,
    last_calibrated_at: e.lastCalibratedAt,
    calibration_due_at: e.calibrationDueAt,
    certificate_no: lastEvent?.certificateNo ?? null,
    qr_token: token,
    verify_path: `/api/public/calibration/verify/${token}`,
  };
};

/** Public label scan. Deliberately minimal — a sticker is not an access grant. */
export const verifyByToken = async (token: string) => {
  const e = await prisma.calibrationInstrument.findFirst({
    where: { qrToken: token, isDeleted: false },
    select: {
      code: true,
      name: true,
      serialNo: true,
      calibrationStatus: true,
      lastCalibratedAt: true,
      calibrationDueAt: true,
      isCalibrationRequired: true,
    },
  });
  if (!e) throw NotFound('Unknown calibration label');

  return {
    code: e.code,
    name: e.name,
    serial_no: e.serialNo,
    calibration_status: e.calibrationStatus,
    last_calibrated_at: e.lastCalibratedAt,
    calibration_due_at: e.calibrationDueAt,
    days_until_due: daysUntil(e.calibrationDueAt),
    is_calibration_required: e.isCalibrationRequired,
    verified_at: new Date(),
  };
};

// ─────────────────────────── Usability guard ───────────────────────────

/**
 * "May this instrument be used to produce data right now?"
 *
 * Exported so any consumer — including LIMS, if a tenant chooses to call it —
 * can ask. Blocking is the feature that separates this module from a
 * spreadsheet with a login screen.
 */
export const assertUsable = async (instrumentId: string): Promise<void> => {
  const e = await prisma.calibrationInstrument.findFirst({
    where: { id: instrumentId, isDeleted: false },
    select: { code: true, name: true, calibrationStatus: true, siteId: true, status: true },
  });
  if (!e) throw NotFound('Instrument not found');
  if (e.status === 'RETIRED') throw BadRequest(`${e.code} is retired and cannot be used`);

  const cfg = await resolveConfig(e.siteId);
  if (isBlocked(e.calibrationStatus, cfg)) {
    throw BadRequest(
      `${e.code} (${e.name}) is ${e.calibrationStatus
        .replace(/_/g, ' ')
        .toLowerCase()} — it cannot be used to produce data until calibration is restored`,
    );
  }
};

/** Non-throwing variant for UIs that grey out rather than fail. */
export const checkUsable = async (instrumentId: string) => {
  try {
    await assertUsable(instrumentId);
    return { usable: true as const, reason: null };
  } catch (err) {
    return { usable: false as const, reason: err instanceof Error ? err.message : 'Unavailable' };
  }
};

// ─────────────────────────── Reference standards ───────────────────────────

export const listStandards = async (expiringWithinDays?: number) => {
  const where: Prisma.CalibrationInstrumentWhereInput = {
    isDeleted: false,
    kind: 'REFERENCE_STANDARD',
    status: { not: 'RETIRED' },
  };
  if (expiringWithinDays !== undefined) {
    where.calibrationDueAt = { lte: addDays(new Date(), expiringWithinDays) };
  }

  const rows = await prisma.calibrationInstrument.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ calibrationDueAt: { sort: 'asc', nulls: 'last' } }],
  });

  const usage = await prisma.calibrationStandardUse.groupBy({
    by: ['standardInstrumentId'],
    where: { standardInstrumentId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const usageMap = new Map(usage.map((u) => [u.standardInstrumentId, u._count._all]));
  const names = await namesFor(rows);

  return {
    data: rows.map((r) => ({
      ...serializeInstrument(r, names),
      times_used: usageMap.get(r.id) ?? 0,
      /** A lapsed standard invalidates every calibration it backed since. */
      is_lapsed: !!r.calibrationDueAt && r.calibrationDueAt.getTime() < Date.now(),
    })),
    total: rows.length,
  };
};

/**
 * Typeahead over LIMS equipment, for operators wiring the optional soft link.
 * Returns an empty list with a reason when LIMS is not part of the deployment.
 */
export const searchLinkableLimsEquipment = async (q: string) => {
  const res = await searchLimsEquipment(q);
  if (!res.ok) return { data: [], available: false as const, reason: res.reason };
  return { data: res.data, available: true as const, reason: null };
};
