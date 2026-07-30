/**
 * Calibration execution — the record.
 *
 * The event carries readings at defined points, judged against limits frozen
 * from the plan version, using standards whose validity is checked at the moment
 * of use. PASS/FAIL is computed here and nowhere else; no endpoint accepts an
 * outcome as input.
 *
 * Lifecycle: PLANNED → SCHEDULED → IN_PROGRESS → PENDING_REVIEW →
 * PENDING_APPROVAL → APPROVED, with the two signature gates collapsed when the
 * site's config does not require them.
 */
import { Prisma } from '@prisma/client';
import type { CalibrationEventStatus, CalibrationOutcome } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { getSignatures, hasCompletedCourse, getOrganization, signRecord, trail } from './integrations';
import {
  TX_OPTIONS,
  computeNextDue,
  daysUntil,
  deriveCalibrationStatus,
  deriveOverall,
  evaluateReading,
  nextSequentialNo,
  num,
  requiresOot,
  resolveConfig,
  rollUpOutcome,
} from './calibration.lib';
import { openAssessmentFor } from './oot.service';
import type {
  AddStandardInput,
  CreateEventInput,
  ListEventsQuery,
  ReviewDecisionInput,
  SaveReadingsInput,
  SignatureInput,
  UpdateEventInput,
} from './calibration.schema';

const parseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const EVENT_INCLUDE = {
  readings: { orderBy: { sequence: 'asc' } },
  standards: true,
  oot: true,
  instrument: {
    select: { id: true, code: true, name: true, kind: true, siteId: true, criticality: true, calibrationStatus: true },
  },
} satisfies Prisma.CalibrationEventInclude;

type EventRow = Prisma.CalibrationEventGetPayload<{ include: typeof EVENT_INCLUDE }>;

export const serializeEvent = (e: EventRow, full = true) => ({
  id: e.id,
  event_no: e.eventNo,
  instrument_id: e.instrumentId,
  instrument_code: e.instrument?.code ?? null,
  instrument_name: e.instrument?.name ?? null,
  instrument_criticality: e.instrument?.criticality ?? null,
  plan_id: e.planId,
  plan_version: e.planVersion,
  type: e.type,
  status: e.status,
  site_id: e.siteId,
  scheduled_for: e.scheduledFor,
  started_at: e.startedAt,
  performed_at: e.performedAt,
  performed_by_id: e.performedById,
  performed_by_external: e.performedByExternal,
  provider_type: e.providerType,
  provider_id: e.providerId,
  ambient_temperature: num(e.ambientTemperature),
  ambient_humidity: num(e.ambientHumidity),
  environment_notes: e.environmentNotes,
  as_found_outcome: e.asFoundOutcome,
  as_left_outcome: e.asLeftOutcome,
  overall_outcome: e.overallOutcome,
  adjustment_made: e.adjustmentMade,
  certificate_no: e.certificateNo,
  certificate_doc_id: e.certificateDocId,
  next_due_at: e.nextDueAt,
  days_until_due: daysUntil(e.nextDueAt),
  remarks: e.remarks,
  ticket_id: e.ticketId,
  reviewed_by_id: e.reviewedById,
  reviewed_at: e.reviewedAt,
  approved_by_id: e.approvedById,
  approved_at: e.approvedAt,
  rejection_reason: e.rejectionReason,
  cancel_reason: e.cancelReason,
  is_overdue: !!e.scheduledFor && e.scheduledFor.getTime() < Date.now() && !['APPROVED', 'CANCELLED', 'REJECTED'].includes(e.status),
  oot_id: e.oot?.id ?? null,
  oot_status: e.oot?.status ?? null,
  created_at: e.createdAt,
  updated_at: e.updatedAt,
  ...(full
    ? {
        readings: e.readings.map((r) => ({
          id: r.id,
          sequence: r.sequence,
          label: r.label,
          nominal_value: num(r.nominalValue),
          unit_code: r.unitCode,
          lower_limit: num(r.lowerLimit),
          upper_limit: num(r.upperLimit),
          as_found_value: num(r.asFoundValue),
          as_found_error: num(r.asFoundError),
          as_found_in_tolerance: r.asFoundInTolerance,
          as_left_value: num(r.asLeftValue),
          as_left_error: num(r.asLeftError),
          as_left_in_tolerance: r.asLeftInTolerance,
          uncertainty: num(r.uncertainty),
          remarks: r.remarks,
        })),
        standards: e.standards.map((s) => ({
          id: s.id,
          standard_instrument_id: s.standardInstrumentId,
          certificate_no: s.certificateNo,
          certificate_valid_until: s.certificateValidUntil,
          traceable_to: s.traceableTo,
          was_valid_at_use: s.wasValidAtUse,
        })),
      }
    : {}),
});

const load = async (id: string): Promise<EventRow> => {
  const e = await prisma.calibrationEvent.findFirst({ where: { id, isDeleted: false }, include: EVENT_INCLUDE });
  if (!e) throw NotFound('Calibration record not found');
  return e;
};

const TERMINAL: CalibrationEventStatus[] = ['APPROVED', 'CANCELLED'];

const assertNotTerminal = (e: EventRow) => {
  if (TERMINAL.includes(e.status)) {
    throw BadRequest(`${e.eventNo} is ${e.status.toLowerCase()} and can no longer be modified`);
  }
};

// ─────────────────────────── List / get ───────────────────────────

export const listEvents = async (q: ListEventsQuery) => {
  const where: Prisma.CalibrationEventWhereInput = { isDeleted: false };
  if (q.status) {
    const list = q.status.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) as CalibrationEventStatus[];
    if (list.length) where.status = { in: list };
  }
  if (q.type) where.type = q.type;
  if (q.instrument_id) where.instrumentId = q.instrument_id;
  if (q.site_id) where.siteId = q.site_id;
  if (q.outcome) where.overallOutcome = q.outcome;
  if (q.provider_id) where.providerId = q.provider_id;
  if (q.overdue) {
    where.scheduledFor = { lt: new Date() };
    where.status = { in: ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_REVIEW', 'PENDING_APPROVAL'] };
  }
  const from = parseDate(q.from);
  const to = parseDate(q.to);
  if (from || to) {
    where.OR = [
      { performedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
      { scheduledFor: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
    ];
  }
  if (q.search) {
    where.AND = [
      {
        OR: [
          { eventNo: { contains: q.search, mode: 'insensitive' } },
          { certificateNo: { contains: q.search, mode: 'insensitive' } },
          { instrument: { code: { contains: q.search, mode: 'insensitive' } } },
          { instrument: { name: { contains: q.search, mode: 'insensitive' } } },
        ],
      },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.calibrationEvent.count({ where }),
    prisma.calibrationEvent.findMany({
      where,
      include: EVENT_INCLUDE,
      orderBy: [{ scheduledFor: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);

  return { data: rows.map((r) => serializeEvent(r, false)), total, page: q.page, page_size: q.page_size };
};

export const getEvent = async (id: string) => {
  const e = await load(id);
  const cfg = await resolveConfig(e.siteId);
  return {
    ...serializeEvent(e),
    config: {
      require_performer_signature: cfg.requirePerformerSignature,
      require_reviewer_signature: cfg.requireReviewerSignature,
      require_approver_signature: cfg.requireApproverSignature,
      oot_impact_assessment_required: cfg.ootImpactAssessmentRequired,
    },
  };
};

// ─────────────────────────── Create ───────────────────────────

/**
 * Create an event and freeze its readings grid from the active plan version.
 * Freezing at creation is what makes a later plan change unable to rewrite the
 * criteria this calibration was performed under.
 */
export const createEvent = async (input: CreateEventInput, userId?: string) => {
  const instrument = await prisma.calibrationInstrument.findFirst({
    where: { id: input.instrument_id, isDeleted: false },
    select: { id: true, code: true, siteId: true, status: true, isCalibrationRequired: true, calibrationDueAt: true },
  });
  if (!instrument) throw NotFound('Instrument not found');
  if (instrument.status === 'RETIRED') throw BadRequest('A retired instrument cannot be calibrated');

  const plan = input.plan_id
    ? await prisma.calibrationPlan.findFirst({ where: { id: input.plan_id, isDeleted: false }, include: { points: true } })
    : await prisma.calibrationPlan.findFirst({
          where: { instrumentId: input.instrument_id, isActive: true, isDeleted: false },
        include: { points: true },
      });

  if (!plan || plan.points.length === 0) {
    throw BadRequest('This instrument has no active calibration plan with points — create a plan first');
  }

  const cfg = await resolveConfig(instrument.siteId);
  const eventNo = await nextSequentialNo('calibrationEvent', cfg.eventNumberPrefix);
  const scheduledFor = parseDate(input.scheduled_for) ?? plan.nextDueAt ?? new Date();

  const created = await prisma.calibrationEvent.create({
    data: {
      eventNo,
      instrumentId: input.instrument_id,
      planId: plan.id,
      planVersion: plan.version,
      type: input.type,
      status: 'SCHEDULED',
      siteId: instrument.siteId,
      scheduledFor,
      providerType: input.provider_type ?? plan.providerType,
      providerId: input.provider_id ?? plan.providerId,
      remarks: input.remarks ?? null,
      createdById: userId ?? null,
      readings: {
        create: plan.points
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((p) => ({
            sequence: p.sequence,
            label: p.label,
            nominalValue: p.nominalValue,
            unitCode: p.unitCode,
            lowerLimit: p.lowerLimit,
            upperLimit: p.upperLimit,
          })),
      },
    },
    include: EVENT_INCLUDE,
  });

  await trail(
    {
      entityType: 'CalibrationEvent',
      entityId: created.id,
      action: 'CREATE',
      newValue: `${eventNo} — ${instrument.code} (plan v${plan.version})`,
    },
    userId,
  );
  return serializeEvent(created);
};

export const updateEvent = async (id: string, input: UpdateEventInput, userId?: string) => {
  const e = await load(id);
  assertNotTerminal(e);

  const updated = await prisma.calibrationEvent.update({
    where: { id },
    data: {
      scheduledFor: input.scheduled_for !== undefined ? parseDate(input.scheduled_for) : undefined,
      performedAt: input.performed_at !== undefined ? parseDate(input.performed_at) : undefined,
      performedById: input.performed_by_id !== undefined ? input.performed_by_id : undefined,
      performedByExternal: input.performed_by_external !== undefined ? input.performed_by_external : undefined,
      providerType: input.provider_type ?? undefined,
      providerId: input.provider_id !== undefined ? input.provider_id : undefined,
      ambientTemperature: input.ambient_temperature !== undefined ? input.ambient_temperature : undefined,
      ambientHumidity: input.ambient_humidity !== undefined ? input.ambient_humidity : undefined,
      environmentNotes: input.environment_notes !== undefined ? input.environment_notes : undefined,
      certificateNo: input.certificate_no !== undefined ? input.certificate_no : undefined,
      certificateDocId: input.certificate_doc_id !== undefined ? input.certificate_doc_id : undefined,
      adjustmentMade: input.adjustment_made ?? undefined,
      remarks: input.remarks !== undefined ? input.remarks : undefined,
    },
    include: EVENT_INCLUDE,
  });

  await trail({ entityType: 'CalibrationEvent', entityId: id, action: 'UPDATE', newValue: e.eventNo }, userId);
  return serializeEvent(updated);
};

// ─────────────────────────── Execution ───────────────────────────

export const startEvent = async (id: string, userId?: string) => {
  const e = await load(id);
  if (!['PLANNED', 'SCHEDULED'].includes(e.status)) {
    throw BadRequest(`${e.eventNo} cannot be started from ${e.status}`);
  }

  const cfg = await resolveConfig(e.siteId);

  // Competency gate (pharma/automotive packs) — an untrained technician's
  // signature is not evidence of anything.
  if (cfg.requireCompetencyToPerform && userId && e.planId) {
    const plan = await prisma.calibrationPlan.findUnique({
      where: { id: e.planId },
      select: { requiredCourseId: true },
    });
    if (plan?.requiredCourseId) {
      const competency = await hasCompletedCourse(userId, plan.requiredCourseId);
      if (!competency.ok) {
        // Training module absent: we cannot verify, and an unverifiable
        // competency claim is not a verified one.
        throw BadRequest(`Competency cannot be verified — ${competency.reason}`);
      }
      if (!competency.data) {
        throw BadRequest('This calibration requires a completed competency course before it can be performed');
      }
    }
  }

  const [updated] = await prisma.$transaction([
    prisma.calibrationEvent.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date(), performedById: e.performedById ?? userId ?? null },
      include: EVENT_INCLUDE,
    }),
    // The instrument is physically out of use from this moment.
    prisma.calibrationInstrument.update({ where: { id: e.instrumentId }, data: { calibrationStatus: 'UNDER_CALIBRATION' } }),
  ]);

  await trail(
    { entityType: 'CalibrationEvent', entityId: id, action: 'UPDATE', field: 'status', oldValue: e.status, newValue: 'IN_PROGRESS' },
    userId,
  );
  return serializeEvent(updated);
};

/**
 * Save readings and evaluate them.
 *
 * Errors and in-tolerance flags are computed from the stored limits — the client
 * sends observed values only. A client that could send `in_tolerance` could send
 * a lie.
 */
export const saveReadings = async (id: string, input: SaveReadingsInput, userId?: string) => {
  const e = await load(id);
  assertNotTerminal(e);
  if (!['IN_PROGRESS', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'REJECTED'].includes(e.status)) {
    throw BadRequest(`Readings can only be entered while the calibration is in progress (currently ${e.status})`);
  }

  const bySeq = new Map(e.readings.map((r) => [r.sequence, r]));
  const updates: Prisma.PrismaPromise<unknown>[] = [];

  for (const r of input.readings) {
    const existing = bySeq.get(r.sequence);
    if (!existing) throw BadRequest(`No calibration point with sequence ${r.sequence} on this record`);

    const nominal = num(existing.nominalValue) ?? 0;
    const lower = num(existing.lowerLimit) ?? 0;
    const upper = num(existing.upperLimit) ?? 0;

    const af = r.as_found_value ?? null;
    const al = r.as_left_value ?? null;
    const afV = af !== null ? evaluateReading(af, nominal, lower, upper) : null;
    const alV = al !== null ? evaluateReading(al, nominal, lower, upper) : null;

    updates.push(
      prisma.calibrationReading.update({
        where: { id: existing.id },
        data: {
          asFoundValue: af,
          asFoundError: afV?.error ?? null,
          asFoundInTolerance: afV?.inTolerance ?? null,
          asLeftValue: al,
          asLeftError: alV?.error ?? null,
          asLeftInTolerance: alV?.inTolerance ?? null,
          uncertainty: r.uncertainty ?? null,
          remarks: r.remarks ?? null,
        },
      }),
    );
  }

  await prisma.$transaction(updates);

  // Roll the point verdicts up to event outcomes.
  const fresh = await prisma.calibrationReading.findMany({ where: { eventId: id }, orderBy: { sequence: 'asc' } });
  const asFound = rollUpOutcome(fresh.map((r) => r.asFoundInTolerance));
  const asLeft = rollUpOutcome(fresh.map((r) => r.asLeftInTolerance));
  const overall = deriveOverall(asFound, asLeft);
  const adjusted = fresh.some((r) => r.asLeftValue !== null && num(r.asLeftValue) !== num(r.asFoundValue));

  const updated = await prisma.calibrationEvent.update({
    where: { id },
    data: { asFoundOutcome: asFound, asLeftOutcome: asLeft, overallOutcome: overall, adjustmentMade: adjusted },
    include: EVENT_INCLUDE,
  });

  await trail(
    {
      entityType: 'CalibrationEvent',
      entityId: id,
      action: 'UPDATE',
      field: 'readings',
      newValue: `${input.readings.length} point(s); as-found ${asFound ?? 'n/a'}, as-left ${asLeft ?? 'n/a'}`,
    },
    userId,
  );
  return serializeEvent(updated);
};

/**
 * Record a reference standard used.
 *
 * `wasValidAtUse` is computed, not accepted: a standard whose own certificate had
 * expired invalidates the calibration it backed, and that judgement cannot be
 * left to whoever is filling the form.
 */
export const addStandard = async (id: string, input: AddStandardInput, userId?: string) => {
  const e = await load(id);
  assertNotTerminal(e);

  const std = await prisma.calibrationInstrument.findFirst({
    where: { id: input.standard_instrument_id, isDeleted: false },
    select: { id: true, code: true, kind: true, calibrationDueAt: true, calibrationStatus: true },
  });
  if (!std) throw NotFound('Reference standard not found');
  if (std.kind !== 'REFERENCE_STANDARD') {
    throw BadRequest(`${std.code} is not registered as a reference standard`);
  }

  const validUntil = parseDate(input.certificate_valid_until) ?? std.calibrationDueAt;
  const at = e.performedAt ?? e.startedAt ?? new Date();
  const wasValid = validUntil ? validUntil.getTime() >= at.getTime() : std.calibrationStatus !== 'OVERDUE';

  const dup = await prisma.calibrationStandardUse.findFirst({
    where: { eventId: id, standardInstrumentId: std.id },
  });
  if (dup) throw Conflict(`${std.code} is already recorded on this calibration`);

  await prisma.calibrationStandardUse.create({
    data: {
      eventId: id,
      standardInstrumentId: std.id,
      certificateNo: input.certificate_no ?? null,
      certificateValidUntil: validUntil,
      traceableTo: input.traceable_to ?? null,
      wasValidAtUse: wasValid,
    },
  });

  await trail(
    {
      entityType: 'CalibrationEvent',
      entityId: id,
      action: 'UPDATE',
      field: 'standards',
      newValue: `${std.code}${wasValid ? '' : ' (LAPSED AT TIME OF USE)'}`,
    },
    userId,
  );
  return getEvent(id);
};

export const removeStandard = async (id: string, useId: string, userId?: string) => {
  const e = await load(id);
  assertNotTerminal(e);
  const use = await prisma.calibrationStandardUse.findFirst({ where: { id: useId, eventId: id } });
  if (!use) throw NotFound('Standard not recorded on this calibration');
  await prisma.calibrationStandardUse.delete({ where: { id: useId } });
  await trail({ entityType: 'CalibrationEvent', entityId: id, action: 'UPDATE', field: 'standards', oldValue: useId }, userId);
  return getEvent(id);
};

// ─────────────────────────── Submit / review / approve ───────────────────────────

/** Where an event goes after submission, given the site's signature policy. */
const nextGate = (cfg: { requireReviewerSignature: boolean; requireApproverSignature: boolean }): CalibrationEventStatus => {
  if (cfg.requireReviewerSignature) return 'PENDING_REVIEW';
  if (cfg.requireApproverSignature) return 'PENDING_APPROVAL';
  return 'PENDING_APPROVAL'; // still needs the explicit close step
};

export const submitEvent = async (id: string, input: SignatureInput, userId?: string) => {
  const e = await load(id);
  if (!['IN_PROGRESS', 'REJECTED'].includes(e.status)) {
    throw BadRequest(`${e.eventNo} cannot be submitted from ${e.status}`);
  }

  const readings = e.readings;
  const anyRecorded = readings.some((r) => r.asFoundValue !== null || r.asLeftValue !== null);
  if (!anyRecorded) throw BadRequest('Record at least one reading before submitting');

  const missingAsFound = readings.filter((r) => r.asFoundValue === null).map((r) => r.label);
  if (missingAsFound.length) {
    // As-found is the field the whole impact assessment hangs on; a partial set
    // makes the retrospective question unanswerable later.
    throw BadRequest(`As-found readings are required for every point. Missing: ${missingAsFound.join(', ')}`);
  }

  const cfg = await resolveConfig(e.siteId);
  const lapsed = e.standards.filter((s) => !s.wasValidAtUse);
  if (lapsed.length) {
    throw BadRequest('One or more reference standards were not valid at the time of use — resolve the traceability before submitting');
  }

  const performedAt = e.performedAt ?? new Date();
  const status = nextGate(cfg);

  const updated = await prisma.calibrationEvent.update({
    where: { id },
    data: {
      status,
      performedAt,
      performedById: e.performedById ?? userId ?? null,
    },
    include: EVENT_INCLUDE,
  });

  if (cfg.requirePerformerSignature) {
    await signRecord({
      entityType: 'CalibrationEvent',
      entityId: id,
      meaning: 'Performed',
      meaningCode: 'CALIBRATION_PERFORMED',
      userId,
      snapshot: {
        eventNo: e.eventNo,
        asFound: updated.asFoundOutcome,
        asLeft: updated.asLeftOutcome,
        readings: readings.map((r) => [r.sequence, num(r.asFoundValue), num(r.asLeftValue)]),
      },
    });
  }

  await trail(
    {
      entityType: 'CalibrationEvent',
      entityId: id,
      action: 'UPDATE',
      field: 'status',
      oldValue: e.status,
      newValue: status,
      reason: input.comments ?? 'Calibration submitted',
    },
    userId,
  );

  return getEvent(id);
};

export const reviewEvent = async (id: string, input: ReviewDecisionInput, userId?: string) => {
  const e = await load(id);
  if (e.status !== 'PENDING_REVIEW') throw BadRequest(`${e.eventNo} is not awaiting review`);

  if (input.decision === 'REJECT') {
    if (!input.reason) throw BadRequest('A reason is required to reject a calibration');
    const rejected = await prisma.calibrationEvent.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: input.reason },
      include: EVENT_INCLUDE,
    });
    await trail(
      { entityType: 'CalibrationEvent', entityId: id, action: 'UPDATE', field: 'status', oldValue: e.status, newValue: 'REJECTED', reason: input.reason },
      userId,
    );
    return serializeEvent(rejected);
  }

  const cfg = await resolveConfig(e.siteId);
  await signRecord({
    entityType: 'CalibrationEvent',
    entityId: id,
    meaning: 'Reviewed',
    meaningCode: 'CALIBRATION_REVIEWED',
    userId,
    snapshot: { eventNo: e.eventNo, overall: e.overallOutcome },
  });

  const updated = await prisma.calibrationEvent.update({
    where: { id },
    data: { status: 'PENDING_APPROVAL', reviewedById: userId ?? null, reviewedAt: new Date() },
    include: EVENT_INCLUDE,
  });

  await trail(
    { entityType: 'CalibrationEvent', entityId: id, action: 'UPDATE', field: 'status', oldValue: e.status, newValue: 'PENDING_APPROVAL', reason: input.comments ?? 'Reviewed' },
    userId,
  );

  // With no approver gate configured, review closes it.
  if (!cfg.requireApproverSignature) return approveEvent(id, { comments: 'Auto-approved: no approver signature configured' }, userId);
  return serializeEvent(updated);
};

/**
 * Approve — the only path that advances the schedule.
 *
 * Refuses to close while an out-of-tolerance assessment is open and the site
 * requires one. That single rule is what makes the pharma and IATF answers
 * auditable rather than aspirational.
 */
export const approveEvent = async (id: string, input: SignatureInput, userId?: string) => {
  const e = await load(id);
  if (!['PENDING_APPROVAL', 'PENDING_REVIEW'].includes(e.status)) {
    throw BadRequest(`${e.eventNo} is not awaiting approval`);
  }

  const cfg = await resolveConfig(e.siteId);
  const needsOot = requiresOot(e.asFoundOutcome, e.overallOutcome);

  if (needsOot && cfg.ootImpactAssessmentRequired) {
    const oot = e.oot ?? (await prisma.outOfToleranceAssessment.findUnique({ where: { eventId: id } }));
    if (!oot) {
      throw BadRequest('An out-of-tolerance impact assessment is required before this calibration can be approved');
    }
    if (oot.status !== 'CLOSED') {
      throw BadRequest(
        `The out-of-tolerance impact assessment is still ${oot.status.replace(/_/g, ' ').toLowerCase()} — close it before approving this calibration`,
      );
    }
  }

  const plan = e.planId
    ? await prisma.calibrationPlan.findUnique({ where: { id: e.planId }, select: { intervalType: true, intervalValue: true, nextDueAt: true } })
    : null;

  const performedAt = e.performedAt ?? new Date();
  const nextDue = plan
    ? computeNextDue({
        intervalType: plan.intervalType,
        intervalValue: plan.intervalValue,
        performedAt,
        previousDueAt: plan.nextDueAt,
        basis: cfg.intervalResetBasis,
      })
    : null;

  // Instrument status follows the outcome: a failed calibration takes the
  // instrument out of service, a conditional one restricts it.
  const instrumentStatus =
    e.overallOutcome === 'FAIL' ? 'OUT_OF_SERVICE' : e.overallOutcome === 'CONDITIONAL' ? 'LIMITED_USE' : 'CALIBRATED';

  const certificateNo = e.certificateNo ?? `${cfg.certificateNumberPrefix}-${e.eventNo}`;

  await signRecord({
    entityType: 'CalibrationEvent',
    entityId: id,
    meaning: 'Approved',
    meaningCode: 'CALIBRATION_APPROVED',
    userId,
    snapshot: {
      eventNo: e.eventNo,
      overall: e.overallOutcome,
      nextDue,
      readings: e.readings.map((r) => [r.sequence, num(r.asFoundValue), num(r.asLeftValue)]),
    },
  });

  const updated = await prisma.$transaction(async (tx) => {
    const ev = await tx.calibrationEvent.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: userId ?? null,
        approvedAt: new Date(),
        performedAt,
        nextDueAt: nextDue,
        certificateNo,
      },
      include: EVENT_INCLUDE,
    });

    await tx.calibrationInstrument.update({
      where: { id: e.instrumentId },
      data: {
        lastCalibratedAt: performedAt,
        calibrationDueAt: nextDue,
        calibrationStatus: instrumentStatus,
        status: e.overallOutcome === 'FAIL' ? 'OUT_OF_SERVICE' : undefined,
      },
    });

    if (e.planId && nextDue) {
      await tx.calibrationPlan.update({ where: { id: e.planId }, data: { nextDueAt: nextDue, lastEventId: id } });
    }
    return ev;
  }, TX_OPTIONS);

  // Re-derive so a next-due already inside the due-soon window shows honestly.
  const inst = await prisma.calibrationInstrument.findUnique({ where: { id: e.instrumentId } });
  if (inst && instrumentStatus === 'CALIBRATED') {
    const derived = deriveCalibrationStatus({
      isCalibrationRequired: inst.isCalibrationRequired,
      instrumentStatus: inst.status,
      current: 'CALIBRATED',
      nextDueAt: inst.calibrationDueAt,
      dueSoonWindowDays: cfg.dueSoonWindowDays,
      graceDays: cfg.graceDays,
    });
    if (derived !== inst.calibrationStatus) {
      await prisma.calibrationInstrument.update({ where: { id: inst.id }, data: { calibrationStatus: derived } });
    }
  }

  await trail(
    {
      entityType: 'CalibrationEvent',
      entityId: id,
      action: 'APPROVE',
      field: 'status',
      oldValue: e.status,
      newValue: 'APPROVED',
      reason: input.comments ?? `Certificate ${certificateNo}`,
    },
    userId,
  );

  return serializeEvent(updated);
};

export const rejectEvent = async (id: string, reason: string, userId?: string) => {
  const e = await load(id);
  assertNotTerminal(e);
  const updated = await prisma.calibrationEvent.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: reason },
    include: EVENT_INCLUDE,
  });
  await trail(
    { entityType: 'CalibrationEvent', entityId: id, action: 'UPDATE', field: 'status', oldValue: e.status, newValue: 'REJECTED', reason },
    userId,
  );
  return serializeEvent(updated);
};

export const cancelEvent = async (id: string, reason: string, userId?: string) => {
  const e = await load(id);
  assertNotTerminal(e);

  const updated = await prisma.calibrationEvent.update({
    where: { id },
    data: { status: 'CANCELLED', cancelReason: reason },
    include: EVENT_INCLUDE,
  });

  // Release the instrument from UNDER_CALIBRATION — it never left, or it came back.
  const inst = await prisma.calibrationInstrument.findUnique({ where: { id: e.instrumentId } });
  if (inst?.calibrationStatus === 'UNDER_CALIBRATION') {
    const cfg = await resolveConfig(inst.siteId);
    await prisma.calibrationInstrument.update({
      where: { id: inst.id },
      data: {
        calibrationStatus: deriveCalibrationStatus({
          isCalibrationRequired: inst.isCalibrationRequired,
          instrumentStatus: inst.status,
          current: 'CALIBRATED',
          nextDueAt: inst.calibrationDueAt,
          dueSoonWindowDays: cfg.dueSoonWindowDays,
          graceDays: cfg.graceDays,
        }),
      },
    });
  }

  await trail(
    { entityType: 'CalibrationEvent', entityId: id, action: 'UPDATE', field: 'status', oldValue: e.status, newValue: 'CANCELLED', reason },
    userId,
  );
  return serializeEvent(updated);
};

/**
 * Raise the OOT assessment for a failed/conditional calibration. Idempotent —
 * called explicitly from the UI and implicitly by the submit path.
 */
export const raiseOot = async (id: string, userId?: string) => {
  const e = await load(id);
  if (!requiresOot(e.asFoundOutcome, e.overallOutcome)) {
    throw BadRequest('This calibration is within tolerance — no impact assessment is required');
  }
  const oot = await openAssessmentFor(id, userId);
  return oot;
};

/** Certificate payload for the PDF renderer. */
export const getCertificate = async (id: string) => {
  const e = await load(id);
  if (e.status !== 'APPROVED') throw BadRequest('A certificate is only issued for an approved calibration');

  const [instrument, org, signatures, standards] = await Promise.all([
    prisma.calibrationInstrument.findUnique({
      where: { id: e.instrumentId },
      include: { category: { select: { name: true } } },
    }),
    getOrganization(),
    getSignatures('CalibrationEvent', id),
    prisma.calibrationStandardUse.findMany({
      where: { eventId: id },
      include: { standard: { select: { code: true, name: true, serialNo: true } } },
    }),
  ]);

  return {
    certificate_no: e.certificateNo,
    event_no: e.eventNo,
    issued_at: e.approvedAt,
    organization: org
      ? { name: org.name, logo_url: org.logoUrl, address: org.address, footer: org.reportFooterText }
      : null,
    instrument: instrument
      ? {
          code: instrument.code,
          name: instrument.name,
          category: instrument.category?.name ?? null,
          manufacturer: instrument.manufacturer,
          model: instrument.model,
          serial_no: instrument.serialNo,
          location: instrument.location,
          lab: instrument.labRef,
          range: [num(instrument.measurementRangeMin), num(instrument.measurementRangeMax)],
          accuracy_class: instrument.accuracyClass,
        }
      : null,
    calibration: {
      type: e.type,
      performed_at: e.performedAt,
      next_due_at: e.nextDueAt,
      as_found_outcome: e.asFoundOutcome,
      as_left_outcome: e.asLeftOutcome,
      overall_outcome: e.overallOutcome,
      adjustment_made: e.adjustmentMade,
      ambient_temperature: num(e.ambientTemperature),
      ambient_humidity: num(e.ambientHumidity),
      provider_type: e.providerType,
      performed_by_external: e.performedByExternal,
      remarks: e.remarks,
      /// IATF §7.1.5.2.1 conformity statement — stated, not implied.
      conformity_statement:
        e.overallOutcome === 'PASS'
          ? 'The instrument conforms to the specified requirements at all calibration points.'
          : e.overallOutcome === 'CONDITIONAL'
            ? 'The instrument was found out of tolerance as received and conforms only after adjustment. Data produced since the previous calibration is subject to impact assessment.'
            : 'The instrument does not conform to the specified requirements and has been withdrawn from service.',
    },
    readings: e.readings.map((r) => ({
      sequence: r.sequence,
      label: r.label,
      nominal: num(r.nominalValue),
      lower_limit: num(r.lowerLimit),
      upper_limit: num(r.upperLimit),
      as_found: num(r.asFoundValue),
      as_found_error: num(r.asFoundError),
      as_found_in_tolerance: r.asFoundInTolerance,
      as_left: num(r.asLeftValue),
      as_left_error: num(r.asLeftError),
      as_left_in_tolerance: r.asLeftInTolerance,
      uncertainty: num(r.uncertainty),
    })),
    standards: standards.map((s) => ({
      code: s.standard.code,
      name: s.standard.name,
      serial_no: s.standard.serialNo,
      certificate_no: s.certificateNo,
      valid_until: s.certificateValidUntil,
      traceable_to: s.traceableTo,
    })),
    signatures,
  };
};

export type { CalibrationOutcome };
