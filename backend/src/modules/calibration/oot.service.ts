/**
 * Out-of-tolerance assessment — the retrospective impact question.
 *
 * Pharma: "show every result reported from this instrument since it last passed."
 * IATF §7.1.5.2.1: the same, plus a customer notification for suspect product
 *   already shipped.
 * BRCGS §6.3: the same, but the window starts at the last passing SHIFT CHECK —
 *   hours ago, not the last calibration months ago.
 *
 * One record, three configured shapes. The window comes from
 * `CalibrationConfig.ootImpactWindow`; the scan below is identical in all three.
 *
 * Every reach outside this module (LIMS results, Deviation/CAPA tickets, Risk)
 * goes through `integrations.ts` and degrades to a reason string rather than an
 * error when the peer module is absent.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import {
  describeLimsRecords,
  scanLimsImpact,
  signRecord,
  spawnRisk,
  spawnTicket,
  trail,
} from './integrations';
import { num, resolveConfig } from './calibration.lib';
import type {
  ListOotQuery,
  NotifyCustomerInput,
  ProductHoldInput,
  SpawnFromOotInput,
  UpdateOotInput,
} from './calibration.schema';

const OOT_INCLUDE = {
  event: {
    select: {
      id: true,
      eventNo: true,
      instrumentId: true,
      performedAt: true,
      asFoundOutcome: true,
      overallOutcome: true,
      siteId: true,
      instrument: { select: { code: true, name: true, criticality: true, limsEquipmentId: true } },
    },
  },
} satisfies Prisma.OutOfToleranceAssessmentInclude;

type OotRow = Prisma.OutOfToleranceAssessmentGetPayload<{ include: typeof OOT_INCLUDE }>;

export const serializeOot = (o: OotRow) => ({
  id: o.id,
  event_id: o.eventId,
  event_no: o.event?.eventNo ?? null,
  instrument_id: o.event?.instrumentId ?? null,
  instrument_code: o.event?.instrument?.code ?? null,
  instrument_name: o.event?.instrument?.name ?? null,
  instrument_criticality: o.event?.instrument?.criticality ?? null,
  as_found_outcome: o.event?.asFoundOutcome ?? null,
  overall_outcome: o.event?.overallOutcome ?? null,
  status: o.status,
  impact_window_from: o.impactWindowFrom,
  impact_window_to: o.impactWindowTo,
  impact_window_days: Math.max(
    0,
    Math.round((o.impactWindowTo.getTime() - o.impactWindowFrom.getTime()) / 86_400_000),
  ),
  max_observed_error: num(o.maxObservedError),
  affected_result_ids: o.affectedResultIds,
  affected_qc_result_ids: o.affectedQcResultIds,
  affected_sample_ids: o.affectedSampleIds,
  affected_batch_refs: o.affectedBatchRefs,
  affected_ticket_ids: o.affectedTicketIds,
  affected_total:
    o.affectedResultIds.length +
    o.affectedQcResultIds.length +
    o.affectedSampleIds.length +
    o.affectedBatchRefs.length,
  last_scanned_at: o.lastScannedAt,
  disposition: o.disposition,
  justification: o.justification,
  qa_comments: o.qaComments,
  deviation_ticket_id: o.deviationTicketId,
  capa_ticket_id: o.capaTicketId,
  risk_id: o.riskId,
  customer_notification_required: o.customerNotificationRequired,
  customer_notified_at: o.customerNotifiedAt,
  customer_notification_ref: o.customerNotificationRef,
  product_hold_required: o.productHoldRequired,
  product_hold_ref: o.productHoldRef,
  assessed_by_id: o.assessedById,
  assessed_at: o.assessedAt,
  approved_by_id: o.approvedById,
  approved_at: o.approvedAt,
  created_at: o.createdAt,
  updated_at: o.updatedAt,
});

const load = async (id: string): Promise<OotRow> => {
  const o = await prisma.outOfToleranceAssessment.findFirst({
    where: { id, isDeleted: false },
    include: OOT_INCLUDE,
  });
  if (!o) throw NotFound('Out-of-tolerance assessment not found');
  return o;
};

// ─────────────────────────── Window computation ───────────────────────────

/**
 * The period under suspicion.
 *
 * SINCE_LAST_CALIBRATION — back to the previous approved calibration (or the
 *   instrument's creation, if this is the first one).
 * SINCE_LAST_PASSING_CHECK — back to the last passing in-use verification. This
 *   is the FMCG answer: a metal detector failing the 14:00 shift check puts
 *   product back to 06:00 on hold, not back to the last six-monthly calibration.
 * FIXED_DAYS — a bounded 90-day look-back.
 */
export const computeImpactWindow = async (
  instrumentId: string,
  eventId: string,
  performedAt: Date,
  window: 'SINCE_LAST_CALIBRATION' | 'SINCE_LAST_PASSING_CHECK' | 'FIXED_DAYS',
): Promise<{ from: Date; to: Date }> => {
  const to = performedAt;

  if (window === 'SINCE_LAST_PASSING_CHECK') {
    const lastPass = await prisma.inUseVerification.findFirst({
      where: { instrumentId, isDeleted: false, outcome: 'PASS', performedAt: { lt: to } },
      orderBy: { performedAt: 'desc' },
      select: { performedAt: true },
    });
    if (lastPass) return { from: lastPass.performedAt, to };
    // No passing check on record — fall through to the calibration window rather
    // than returning a zero-width one, which would read as "no impact".
  }

  if (window === 'FIXED_DAYS') {
    const from = new Date(to);
    from.setDate(from.getDate() - 90);
    return { from, to };
  }

  const prev = await prisma.calibrationEvent.findFirst({
    where: { instrumentId, isDeleted: false, status: 'APPROVED', id: { not: eventId }, performedAt: { lt: to } },
    orderBy: { performedAt: 'desc' },
    select: { performedAt: true },
  });
  if (prev?.performedAt) return { from: prev.performedAt, to };

  const inst = await prisma.calibrationInstrument.findUnique({
    where: { id: instrumentId },
    select: { createdAt: true },
  });
  return { from: inst?.createdAt ?? new Date(to.getTime() - 365 * 86_400_000), to };
};

// ─────────────────────────── Impact scan ───────────────────────────

/**
 * Everything this instrument touched inside the window.
 *
 * Two sources, and the module works with either:
 *   - LIMS results / QC results / samples, when the instrument carries a soft
 *     `limsEquipmentId` and LIMS is installed;
 *   - batch references captured on in-use checks, which is the production-floor
 *     trail and needs nothing outside this module.
 *
 * When the LIMS side is unavailable the reason is surfaced rather than silently
 * yielding an empty result set — "we did not look" and "we looked and found
 * nothing" are very different answers to an auditor.
 */
export const scanImpact = async (ootId: string, userId?: string) => {
  const o = await load(ootId);
  if (!o.event) throw BadRequest('Assessment has no linked calibration record');

  const { instrumentId, instrument } = o.event;
  const from = o.impactWindowFrom;
  const to = o.impactWindowTo;

  const [lims, checks] = await Promise.all([
    scanLimsImpact(instrument?.limsEquipmentId ?? null, from, to),
    prisma.inUseVerification.findMany({
      where: { instrumentId, performedAt: { gte: from, lte: to }, isDeleted: false, batchRef: { not: null } },
      select: { batchRef: true },
    }),
  ]);

  const batchRefs = new Set<string>(o.affectedBatchRefs);
  for (const c of checks) if (c.batchRef) batchRefs.add(c.batchRef);

  // Worst as-found excursion across the failed points — the magnitude question
  // that usually decides whether the impact is real.
  const errors = await prisma.calibrationReading.aggregate({
    where: { eventId: o.eventId, asFoundInTolerance: false },
    _max: { asFoundError: true },
    _min: { asFoundError: true },
  });
  const hi = num(errors._max.asFoundError) ?? 0;
  const lo = num(errors._min.asFoundError) ?? 0;
  const worst = Math.abs(hi) >= Math.abs(lo) ? hi : lo;

  const updated = await prisma.outOfToleranceAssessment.update({
    where: { id: ootId },
    data: {
      affectedResultIds: lims.ok ? lims.data.resultIds : o.affectedResultIds,
      affectedQcResultIds: lims.ok ? lims.data.qcResultIds : o.affectedQcResultIds,
      affectedSampleIds: lims.ok ? lims.data.sampleIds : o.affectedSampleIds,
      affectedBatchRefs: [...batchRefs],
      maxObservedError: worst || null,
      lastScannedAt: new Date(),
      status: o.status === 'OPEN' ? 'IMPACT_IN_PROGRESS' : o.status,
      assessedById: o.assessedById ?? userId ?? null,
    },
    include: OOT_INCLUDE,
  });

  const summary = lims.ok
    ? `${lims.data.resultIds.length} result(s), ${lims.data.qcResultIds.length} QC result(s), ${lims.data.sampleIds.length} sample(s), ${batchRefs.size} batch ref(s)`
    : `${batchRefs.size} batch ref(s); LIMS scan skipped — ${lims.reason}`;

  await trail(
    {
      entityType: 'OutOfToleranceAssessment',
      entityId: ootId,
      action: 'UPDATE',
      field: 'impactScan',
      newValue: summary,
      reason: `Window ${from.toISOString()} → ${to.toISOString()}`,
    },
    userId,
  );

  return {
    ...serializeOot(updated),
    lims_scan: lims.ok ? { available: true as const, reason: null } : { available: false as const, reason: lims.reason },
  };
};

// ─────────────────────────── Open / list / get ───────────────────────────

/** Idempotent: called from the calibration submit path and from the UI. */
export const openAssessmentFor = async (eventId: string, userId?: string) => {
  const existing = await prisma.outOfToleranceAssessment.findUnique({
    where: { eventId },
    include: OOT_INCLUDE,
  });
  if (existing) return serializeOot(existing);

  const event = await prisma.calibrationEvent.findFirst({
    where: { id: eventId, isDeleted: false },
    select: { id: true, eventNo: true, instrumentId: true, performedAt: true, startedAt: true, siteId: true },
  });
  if (!event) throw NotFound('Calibration record not found');

  const cfg = await resolveConfig(event.siteId);
  const at = event.performedAt ?? event.startedAt ?? new Date();
  const { from, to } = await computeImpactWindow(event.instrumentId, eventId, at, cfg.ootImpactWindow);

  const created = await prisma.outOfToleranceAssessment.create({
    data: {
      eventId,
      status: 'OPEN',
      impactWindowFrom: from,
      impactWindowTo: to,
      customerNotificationRequired: cfg.ootRequiresCustomerNotification,
      productHoldRequired: cfg.ootRequiresProductHold,
    },
    include: OOT_INCLUDE,
  });

  await trail(
    {
      entityType: 'OutOfToleranceAssessment',
      entityId: created.id,
      action: 'CREATE',
      newValue: `Raised from ${event.eventNo}`,
      reason: `Impact window (${cfg.ootImpactWindow}): ${from.toISOString()} → ${to.toISOString()}`,
    },
    userId,
  );

  // Scan immediately — an assessment nobody scans is worse than none at all.
  return scanImpact(created.id, userId);
};

export const listOot = async (q: ListOotQuery) => {
  const where: Prisma.OutOfToleranceAssessmentWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;
  const eventFilter: Prisma.CalibrationEventWhereInput = {};
  if (q.site_id) eventFilter.siteId = q.site_id;
  if (q.instrument_id) eventFilter.instrumentId = q.instrument_id;
  if (Object.keys(eventFilter).length) where.event = eventFilter;

  const [total, rows] = await Promise.all([
    prisma.outOfToleranceAssessment.count({ where }),
    prisma.outOfToleranceAssessment.findMany({
      where,
      include: OOT_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);

  return { data: rows.map(serializeOot), total, page: q.page, page_size: q.page_size };
};

/** Detail view resolves the affected ids into something a human can read. */
export const getOot = async (id: string) => {
  const o = await load(id);
  const described = await describeLimsRecords({
    resultIds: o.affectedResultIds,
    sampleIds: o.affectedSampleIds,
    qcResultIds: o.affectedQcResultIds,
  });

  return {
    ...serializeOot(o),
    lims_linked: !!o.event?.instrument?.limsEquipmentId,
    affected_results: described.results,
    affected_samples: described.samples,
    affected_qc_results: described.qc_results,
  };
};

// ─────────────────────────── Assessment ───────────────────────────

export const updateOot = async (id: string, input: UpdateOotInput, userId?: string) => {
  const o = await load(id);
  if (o.status === 'CLOSED') throw BadRequest('This assessment is closed');

  const updated = await prisma.outOfToleranceAssessment.update({
    where: { id },
    data: {
      disposition: input.disposition ?? undefined,
      justification: input.justification !== undefined ? input.justification : undefined,
      qaComments: input.qa_comments !== undefined ? input.qa_comments : undefined,
      affectedBatchRefs: input.affected_batch_refs ?? undefined,
      productHoldRef: input.product_hold_ref !== undefined ? input.product_hold_ref : undefined,
      status: o.status === 'OPEN' ? 'IMPACT_IN_PROGRESS' : o.status,
      assessedById: o.assessedById ?? userId ?? null,
      assessedAt: o.assessedAt ?? new Date(),
    },
    include: OOT_INCLUDE,
  });

  await trail(
    {
      entityType: 'OutOfToleranceAssessment',
      entityId: id,
      action: 'UPDATE',
      newValue: input.disposition ?? 'assessment updated',
    },
    userId,
  );
  return serializeOot(updated);
};

export const submitOotForApproval = async (id: string, userId?: string) => {
  const o = await load(id);
  if (o.status === 'CLOSED') throw BadRequest('This assessment is closed');
  if (!o.disposition) throw BadRequest('Record a disposition before submitting for approval');
  if (!o.justification) throw BadRequest('A justification is required before submitting for approval');

  if (o.customerNotificationRequired && o.disposition === 'IMPACT_CONFIRMED' && !o.customerNotifiedAt) {
    throw BadRequest(
      'Confirmed impact requires a customer notification to be recorded before approval (IATF 16949 §7.1.5.2.1)',
    );
  }
  if (o.productHoldRequired && o.disposition === 'IMPACT_CONFIRMED' && !o.productHoldRef) {
    throw BadRequest('Confirmed impact requires a product-hold reference before approval');
  }

  const updated = await prisma.outOfToleranceAssessment.update({
    where: { id },
    data: {
      status: 'PENDING_QA_APPROVAL',
      assessedById: o.assessedById ?? userId ?? null,
      assessedAt: o.assessedAt ?? new Date(),
    },
    include: OOT_INCLUDE,
  });
  await trail(
    {
      entityType: 'OutOfToleranceAssessment',
      entityId: id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: o.status,
      newValue: 'PENDING_QA_APPROVAL',
    },
    userId,
  );
  return serializeOot(updated);
};

export const approveOot = async (id: string, comments: string | null | undefined, userId?: string) => {
  const o = await load(id);
  if (o.status === 'CLOSED') throw BadRequest('This assessment is already closed');
  if (!o.disposition) throw BadRequest('Record a disposition before closing');

  await signRecord({
    entityType: 'OutOfToleranceAssessment',
    entityId: id,
    meaning: 'Impact assessment approved',
    meaningCode: 'OOT_APPROVED',
    userId,
    snapshot: {
      disposition: o.disposition,
      window: [o.impactWindowFrom, o.impactWindowTo],
      affected: o.affectedResultIds.length + o.affectedSampleIds.length + o.affectedBatchRefs.length,
    },
  });

  const updated = await prisma.outOfToleranceAssessment.update({
    where: { id },
    data: {
      status: 'CLOSED',
      approvedById: userId ?? null,
      approvedAt: new Date(),
      qaComments: comments ?? o.qaComments,
    },
    include: OOT_INCLUDE,
  });

  await trail(
    {
      entityType: 'OutOfToleranceAssessment',
      entityId: id,
      action: 'APPROVE',
      field: 'status',
      oldValue: o.status,
      newValue: 'CLOSED',
      reason: comments ?? `Disposition: ${o.disposition}`,
    },
    userId,
  );
  return serializeOot(updated);
};

// ─────────────────────────── Industry obligations ───────────────────────────

/** IATF 16949 §7.1.5.2.1 — suspect product already shipped. */
export const notifyCustomer = async (id: string, input: NotifyCustomerInput, userId?: string) => {
  await load(id);
  const updated = await prisma.outOfToleranceAssessment.update({
    where: { id },
    data: { customerNotifiedAt: new Date(), customerNotificationRef: input.reference },
    include: OOT_INCLUDE,
  });
  await trail(
    {
      entityType: 'OutOfToleranceAssessment',
      entityId: id,
      action: 'UPDATE',
      field: 'customerNotification',
      newValue: input.reference,
      reason: input.notes ?? 'Customer notified of suspect product (IATF 16949 §7.1.5.2.1)',
    },
    userId,
  );
  return serializeOot(updated);
};

/** BRCGS / FSSC — product back to the last passing check goes on hold. */
export const recordProductHold = async (id: string, input: ProductHoldInput, userId?: string) => {
  const o = await load(id);
  const updated = await prisma.outOfToleranceAssessment.update({
    where: { id },
    data: { productHoldRef: input.reference, productHoldRequired: true },
    include: OOT_INCLUDE,
  });
  await trail(
    {
      entityType: 'OutOfToleranceAssessment',
      entityId: id,
      action: 'UPDATE',
      field: 'productHold',
      newValue: input.reference,
      reason:
        input.notes ??
        `Product hold raised for window ${o.impactWindowFrom.toISOString()} → ${o.impactWindowTo.toISOString()}`,
    },
    userId,
  );
  return serializeOot(updated);
};

// ─────────────────────────── Cross-module spawn ───────────────────────────

/**
 * Raise a Deviation / CAPA ticket, or a Risk, from the assessment.
 *
 * All three go through `integrations.ts`. If the peer module is not configured
 * the caller gets a 400 carrying the reason, and the assessment stays valid and
 * self-contained — it simply did not hand off.
 */
export const spawnFromOot = async (id: string, input: SpawnFromOotInput, userId?: string) => {
  const o = await load(id);
  if (!o.event) throw BadRequest('Assessment has no linked calibration record');

  const code = o.event.instrument?.code ?? 'Instrument';
  const title = input.title ?? `${code} out of tolerance (${o.event.eventNo})`;
  const windowLine = `${o.impactWindowFrom.toISOString().slice(0, 10)} → ${o.impactWindowTo.toISOString().slice(0, 10)}`;
  const scope =
    `${o.affectedResultIds.length} result(s), ${o.affectedQcResultIds.length} QC result(s), ` +
    `${o.affectedSampleIds.length} sample(s), ${o.affectedBatchRefs.length} batch reference(s)`;

  if (input.kind === 'RISK') {
    if (o.riskId) throw BadRequest('A risk is already linked to this assessment');

    const res = await spawnRisk({
      title,
      description:
        `Instrument ${code} was found out of tolerance during calibration ${o.event.eventNo}. ` +
        `Impact window ${windowLine}; ${scope} within scope.`,
      instrumentId: o.event.instrumentId,
      instrumentCode: code,
      siteId: o.event.siteId,
      userId,
    });
    if (!res.ok) throw BadRequest(res.reason);

    const updated = await prisma.outOfToleranceAssessment.update({
      where: { id },
      data: { riskId: res.data.id },
      include: OOT_INCLUDE,
    });
    await trail(
      {
        entityType: 'OutOfToleranceAssessment',
        entityId: id,
        action: 'UPDATE',
        field: 'riskId',
        newValue: res.data.riskNumber,
        reason: 'Risk raised from out-of-tolerance assessment',
      },
      userId,
    );
    return { ...serializeOot(updated), spawned: { kind: 'RISK' as const, id: res.data.id, reference: res.data.riskNumber } };
  }

  const existingId = input.kind === 'CAPA' ? o.capaTicketId : o.deviationTicketId;
  if (existingId) throw BadRequest(`A ${input.kind} is already linked to this assessment`);

  const res = await spawnTicket({
    typeName: input.kind === 'CAPA' ? 'CAPA' : 'Deviation',
    uniqueIdHint: `${input.kind === 'CAPA' ? 'CAPA' : 'DEV'}-OOT-${o.event.eventNo}`,
    title,
    description:
      `Raised automatically from calibration ${o.event.eventNo}.\n\n` +
      `Instrument: ${code} — ${o.event.instrument?.name ?? ''}\n` +
      `As-found outcome: ${o.event.asFoundOutcome ?? 'n/a'} · Overall: ${o.event.overallOutcome ?? 'n/a'}\n` +
      `Impact window: ${windowLine}\n` +
      `Affected: ${scope}.`,
    reason: 'Calibration out-of-tolerance impact',
    siteId: o.event.siteId,
    userId,
  });
  if (!res.ok) throw BadRequest(res.reason);

  const updated = await prisma.outOfToleranceAssessment.update({
    where: { id },
    data: {
      deviationTicketId: input.kind === 'DEVIATION' ? res.data.id : undefined,
      capaTicketId: input.kind === 'CAPA' ? res.data.id : undefined,
      affectedTicketIds: { push: res.data.id },
    },
    include: OOT_INCLUDE,
  });

  await trail(
    {
      entityType: 'OutOfToleranceAssessment',
      entityId: id,
      action: 'UPDATE',
      field: input.kind === 'CAPA' ? 'capaTicketId' : 'deviationTicketId',
      newValue: res.data.uniqueId,
      reason: `${input.kind} spawned from out-of-tolerance assessment`,
    },
    userId,
  );

  return { ...serializeOot(updated), spawned: { kind: input.kind, id: res.data.id, reference: res.data.uniqueId } };
};
