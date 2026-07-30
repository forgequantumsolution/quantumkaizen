/**
 * In-use verification — the high-frequency check.
 *
 * Not every control is a full calibration. A balance gets a daily check-weight
 * verification; a metal detector gets a test-piece pass every shift. These are
 * what an FMCG plant actually lives on, and — crucially — a failure here puts
 * product on hold back to the last PASSING check, which is hours ago, not back
 * to the last calibration months ago.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { trail } from './integrations';
import { addDays, resolveConfig } from './calibration.lib';
import type { CreateCheckInput, ListChecksQuery } from './calibration.schema';

type CheckRow = Prisma.InUseVerificationGetPayload<{
  include: { instrument: { select: { code: true; name: true; kind: true } } };
}>;

const INCLUDE = {
  instrument: { select: { code: true, name: true, kind: true } },
} satisfies Prisma.InUseVerificationInclude;

export const serializeCheck = (c: CheckRow) => ({
  id: c.id,
  instrument_id: c.instrumentId,
  instrument_code: c.instrument?.code ?? null,
  instrument_name: c.instrument?.name ?? null,
  performed_at: c.performedAt,
  performed_by_id: c.performedById,
  shift: c.shift,
  outcome: c.outcome,
  readings: c.readings,
  batch_ref: c.batchRef,
  remarks: c.remarks,
  hold_triggered: c.holdTriggered,
  hold_ref: c.holdRef,
  hold_window_from: c.holdWindowFrom,
  created_at: c.createdAt,
});

export const listChecks = async (q: ListChecksQuery) => {
  const where: Prisma.InUseVerificationWhereInput = { isDeleted: false };
  if (q.instrument_id) where.instrumentId = q.instrument_id;
  if (q.outcome) where.outcome = q.outcome;
  if (q.from || q.to) {
    where.performedAt = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to ? { lte: new Date(q.to) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.inUseVerification.count({ where }),
    prisma.inUseVerification.findMany({
      where,
      include: INCLUDE,
      orderBy: { performedAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);

  return { data: rows.map(serializeCheck), total, page: q.page, page_size: q.page_size };
};

/**
 * Record a check.
 *
 * The outcome is derived from the per-reading in-tolerance flags, and a failure
 * computes the hold window from the previous passing check. That window is the
 * whole point of the record: it is the answer to "what product is suspect?".
 */
export const createCheck = async (instrumentId: string, input: CreateCheckInput, userId?: string) => {
  const instrument = await prisma.calibrationInstrument.findFirst({
    where: { id: instrumentId, isDeleted: false },
    select: { id: true, code: true, siteId: true, status: true },
  });
  if (!instrument) throw NotFound('Instrument not found');
  if (instrument.status === 'RETIRED') throw BadRequest('A retired instrument cannot be verified');

  const performedAt = input.performed_at ? new Date(input.performed_at) : new Date();
  if (Number.isNaN(performedAt.getTime())) throw BadRequest('Invalid performed_at date');

  const failed = input.readings.some((r) => !r.in_tolerance);
  const outcome = failed ? 'FAIL' : 'PASS';

  // Hold window: back to the previous passing check. With none on record the
  // window opens at the instrument's last calibration, then at its creation —
  // an unbounded "we don't know" is still better than a silent zero-width one.
  let holdWindowFrom: Date | null = null;
  if (failed) {
    const lastPass = await prisma.inUseVerification.findFirst({
      where: { instrumentId, isDeleted: false, outcome: 'PASS', performedAt: { lt: performedAt } },
      orderBy: { performedAt: 'desc' },
      select: { performedAt: true },
    });
    if (lastPass) {
      holdWindowFrom = lastPass.performedAt;
    } else {
      const lastCal = await prisma.calibrationEvent.findFirst({
        where: { instrumentId, isDeleted: false, status: 'APPROVED', performedAt: { lt: performedAt } },
        orderBy: { performedAt: 'desc' },
        select: { performedAt: true },
      });
      holdWindowFrom = lastCal?.performedAt ?? null;
    }
  }

  const cfg = await resolveConfig(instrument.siteId);

  const created = await prisma.inUseVerification.create({
    data: {
      instrumentId,
      performedAt,
      performedById: userId ?? null,
      shift: input.shift ?? null,
      outcome,
      readings: input.readings as unknown as Prisma.InputJsonValue,
      batchRef: input.batch_ref ?? null,
      remarks: input.remarks ?? null,
      holdTriggered: failed && cfg.ootRequiresProductHold,
      holdWindowFrom,
      createdById: userId ?? null,
    },
    include: INCLUDE,
  });

  // A failing CCP device is out of service until someone says otherwise.
  if (failed && cfg.blockUseWhenFailed) {
    await prisma.calibrationInstrument.update({
      where: { id: instrumentId },
      data: { calibrationStatus: 'OUT_OF_SERVICE', status: 'OUT_OF_SERVICE' },
    });
  }

  await trail(
    {
      entityType: 'InUseVerification',
      entityId: created.id,
      action: 'CREATE',
      newValue: `${instrument.code} — ${outcome}${input.shift ? ` (shift ${input.shift})` : ''}`,
      reason: failed
        ? `Failed check. Product suspect from ${holdWindowFrom?.toISOString() ?? 'unknown'} to ${performedAt.toISOString()}`
        : null,
    },
    userId,
  );

  return {
    ...serializeCheck(created),
    hold_window: failed
      ? {
          from: holdWindowFrom,
          to: performedAt,
          hours: holdWindowFrom
            ? Math.round(((performedAt.getTime() - holdWindowFrom.getTime()) / 3_600_000) * 10) / 10
            : null,
          note: holdWindowFrom
            ? 'Product produced in this window is suspect — back to the last passing check.'
            : 'No previous passing check on record; the suspect window is unbounded.',
        }
      : null,
  };
};

/**
 * Which instruments owe a check right now.
 *
 * Driven by the category's `inUseCheckFrequency`, so an FMCG pack's per-shift
 * metal-detector checks appear here automatically once the pack is applied.
 */
export const listDueChecks = async (siteId?: string) => {
  const instruments = await prisma.calibrationInstrument.findMany({
    where: {
      isDeleted: false,
      status: 'ACTIVE',
      ...(siteId ? { siteId } : {}),
      category: { requiresInUseCheck: true, isDeleted: false },
    },
    include: {
      category: { select: { name: true, inUseCheckFrequency: true } },
      inUseChecks: { orderBy: { performedAt: 'desc' }, take: 1, select: { performedAt: true, outcome: true } },
    },
    orderBy: { code: 'asc' },
  });

  const now = new Date();
  const windowFor = (freq: string | null): Date => {
    switch (freq) {
      case 'PER_SHIFT':
        return new Date(now.getTime() - 8 * 3_600_000);
      case 'DAILY':
        return addDays(now, -1);
      case 'WEEKLY':
        return addDays(now, -7);
      case 'MONTHLY':
        return addDays(now, -30);
      // PER_BATCH has no clock; surface it every shift so it is not forgotten.
      default:
        return new Date(now.getTime() - 8 * 3_600_000);
    }
  };

  const rows = instruments.map((i) => {
    const last = i.inUseChecks[0] ?? null;
    const since = windowFor(i.category?.inUseCheckFrequency ?? null);
    const isDue = !last || last.performedAt < since;
    return {
      instrument_id: i.id,
      code: i.code,
      name: i.name,
      category_name: i.category?.name ?? null,
      frequency: i.category?.inUseCheckFrequency ?? null,
      last_check_at: last?.performedAt ?? null,
      last_outcome: last?.outcome ?? null,
      is_due: isDue,
      hours_since_last: last ? Math.round(((now.getTime() - last.performedAt.getTime()) / 3_600_000) * 10) / 10 : null,
    };
  });

  return { data: rows.filter((r) => r.is_due), all: rows, total: rows.filter((r) => r.is_due).length };
};
