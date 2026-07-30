/**
 * Measurement systems analysis — IATF 16949 §7.1.5.1.1 / AIAG MSA 4th ed.
 *
 * Implements the average-and-range method for crossed Gage R&R, which is the
 * one an automotive auditor expects to see and the one that can be recomputed
 * by hand from the stored trials. ANOVA gives tighter estimates but cannot be
 * reproduced from a printout, which matters more here than the extra precision.
 *
 * Gated by `CalibrationConfig.enableMsa`, so only the Automotive pack surfaces
 * it — the maths is always here, the capability is configured.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { trail } from './integrations';
import { nextSequentialNo, num, resolveConfig } from './calibration.lib';
import type { CreateMsaInput, ListMsaQuery, SaveMsaTrialsInput } from './calibration.schema';

/**
 * AIAG constants.
 *
 * K1 by trial count, K2 by operator count, d2* by subgroup size for the part
 * range. Values beyond the tabulated range fall back to the last entry rather
 * than throwing — a 12-part study should still compute.
 */
const K1: Record<number, number> = { 2: 0.8862, 3: 0.5908, 4: 0.4849, 5: 0.4030, 6: 0.3512 };
const K2: Record<number, number> = { 1: 1.0, 2: 0.7071, 3: 0.5231, 4: 0.4467, 5: 0.4030, 6: 0.3742 };
const D2: Record<number, number> = {
  2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704, 8: 2.847, 9: 2.970, 10: 3.078,
  11: 3.173, 12: 3.258, 13: 3.336, 14: 3.407, 15: 3.472, 20: 3.735, 25: 3.931,
};

const lookup = (table: Record<number, number>, n: number): number => {
  if (table[n] !== undefined) return table[n]!;
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const below = keys.filter((k) => k <= n).pop();
  return table[below ?? keys[keys.length - 1]!]!;
};

const round = (v: number, dp = 6): number => Number(v.toFixed(dp));

export interface GrrResult {
  ev: number;
  av: number;
  grr: number;
  pv: number;
  tv: number;
  grrPercent: number;
  ndc: number;
  verdict: 'ACCEPTABLE' | 'CONDITIONAL' | 'UNACCEPTABLE';
}

/**
 * Average-and-range Gage R&R.
 *
 * `%GRR` is expressed against the tolerance when one is supplied (the automotive
 * default — a gauge is judged against what it must discriminate) and against
 * total variation otherwise.
 */
export const computeGrr = (
  trials: { partNo: number; operator: number; trial: number; measured: number }[],
  tolerance?: number | null,
): GrrResult => {
  if (trials.length === 0) throw BadRequest('No trial data to compute');

  const parts = [...new Set(trials.map((t) => t.partNo))].sort((a, b) => a - b);
  const operators = [...new Set(trials.map((t) => t.operator))].sort((a, b) => a - b);
  const trialNos = [...new Set(trials.map((t) => t.trial))];
  const n = parts.length;
  const k = operators.length;
  const r = trialNos.length;

  if (n < 2) throw BadRequest('Gage R&R needs at least 2 parts');
  if (r < 2) throw BadRequest('Gage R&R needs at least 2 trials per part');

  const cell = (p: number, o: number) =>
    trials.filter((t) => t.partNo === p && t.operator === o).map((t) => t.measured);

  // Rbar — mean of the within-cell ranges. Repeatability lives here.
  const ranges: number[] = [];
  for (const p of parts) {
    for (const o of operators) {
      const vals = cell(p, o);
      if (vals.length >= 2) ranges.push(Math.max(...vals) - Math.min(...vals));
    }
  }
  const rBar = ranges.length ? ranges.reduce((a, b) => a + b, 0) / ranges.length : 0;

  // Xdiff — spread of operator means. Reproducibility lives here.
  const operatorMeans = operators.map((o) => {
    const vals = trials.filter((t) => t.operator === o).map((t) => t.measured);
    return vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  });
  const xDiff = operatorMeans.length ? Math.max(...operatorMeans) - Math.min(...operatorMeans) : 0;

  // Rp — range of part averages. Part variation lives here.
  const partMeans = parts.map((p) => {
    const vals = trials.filter((t) => t.partNo === p).map((t) => t.measured);
    return vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  });
  const rp = partMeans.length ? Math.max(...partMeans) - Math.min(...partMeans) : 0;

  const ev = rBar * lookup(K1, r);
  // AV subtracts the repeatability already counted in the operator spread;
  // a negative radicand means operator effect is swamped by noise → AV = 0.
  const avSquared = (xDiff * lookup(K2, k)) ** 2 - (ev * ev) / (n * r);
  const av = avSquared > 0 ? Math.sqrt(avSquared) : 0;

  const grr = Math.sqrt(ev * ev + av * av);
  // PV = Rp / d2*, where the subgroup size is the number of PARTS.
  const pv = rp / lookup(D2, n);
  const tv = Math.sqrt(grr * grr + pv * pv);

  const basis = tolerance && tolerance > 0 ? tolerance : tv;
  const grrPercent = basis > 0 ? (grr / basis) * 100 : 0;
  const ndc = pv > 0 && grr > 0 ? Math.max(0, Math.floor((pv / grr) * 1.41)) : 0;

  const verdict: GrrResult['verdict'] =
    grrPercent < 10 ? 'ACCEPTABLE' : grrPercent <= 30 ? 'CONDITIONAL' : 'UNACCEPTABLE';

  return {
    ev: round(ev),
    av: round(av),
    grr: round(grr),
    pv: round(pv),
    tv: round(tv),
    grrPercent: round(grrPercent, 4),
    ndc,
    verdict,
  };
};

// ─────────────────────────── Service ───────────────────────────

const INCLUDE = {
  trials: { orderBy: [{ partNo: 'asc' }, { operator: 'asc' }, { trial: 'asc' }] },
  instrument: { select: { code: true, name: true } },
} satisfies Prisma.MsaStudyInclude;

type StudyRow = Prisma.MsaStudyGetPayload<{ include: typeof INCLUDE }>;

export const serializeStudy = (s: StudyRow, full = true) => ({
  id: s.id,
  study_no: s.studyNo,
  instrument_id: s.instrumentId,
  instrument_code: s.instrument?.code ?? null,
  instrument_name: s.instrument?.name ?? null,
  type: s.type,
  performed_at: s.performedAt,
  performed_by_id: s.performedById,
  part_count: s.partCount,
  operator_count: s.operatorCount,
  trial_count: s.trialCount,
  repeatability_ev: num(s.repeatabilityEv),
  reproducibility_av: num(s.reproducibilityAv),
  grr: num(s.grr),
  part_variation: num(s.partVariation),
  total_variation: num(s.totalVariation),
  grr_percent: num(s.grrPercent),
  ndc: s.ndc,
  verdict: s.verdict,
  tolerance_used: num(s.toleranceUsed),
  notes: s.notes,
  approved_by_id: s.approvedById,
  approved_at: s.approvedAt,
  trial_data_count: s.trials.length,
  created_at: s.createdAt,
  ...(full
    ? {
        trials: s.trials.map((t) => ({
          part_no: t.partNo,
          operator: t.operator,
          trial: t.trial,
          measured: num(t.measured),
        })),
      }
    : {}),
});

const load = async (id: string): Promise<StudyRow> => {
  const s = await prisma.msaStudy.findFirst({ where: { id, isDeleted: false }, include: INCLUDE });
  if (!s) throw NotFound('MSA study not found');
  return s;
};

export const listStudies = async (q: ListMsaQuery) => {
  const where: Prisma.MsaStudyWhereInput = { isDeleted: false };
  if (q.instrument_id) where.instrumentId = q.instrument_id;
  if (q.type) where.type = q.type;

  const [total, rows] = await Promise.all([
    prisma.msaStudy.count({ where }),
    prisma.msaStudy.findMany({
      where,
      include: INCLUDE,
      orderBy: { performedAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);
  return { data: rows.map((r) => serializeStudy(r, false)), total, page: q.page, page_size: q.page_size };
};

export const getStudy = async (id: string) => serializeStudy(await load(id));

export const createStudy = async (input: CreateMsaInput, userId?: string) => {
  const instrument = await prisma.calibrationInstrument.findFirst({
    where: { id: input.instrument_id, isDeleted: false },
    select: { id: true, code: true, siteId: true },
  });
  if (!instrument) throw NotFound('Instrument not found');

  const cfg = await resolveConfig(instrument.siteId);
  if (!cfg.enableMsa) {
    throw BadRequest('Measurement systems analysis is not enabled for this site — enable it in Calibration settings');
  }

  const studyNo = await nextSequentialNo('msaStudy', 'MSA');
  const created = await prisma.msaStudy.create({
    data: {
      studyNo,
      instrumentId: input.instrument_id,
      type: input.type,
      performedAt: input.performed_at ? new Date(input.performed_at) : new Date(),
      performedById: userId ?? null,
      partCount: input.part_count,
      operatorCount: input.operator_count,
      trialCount: input.trial_count,
      toleranceUsed: input.tolerance_used ?? null,
      notes: input.notes ?? null,
      createdById: userId ?? null,
    },
    include: INCLUDE,
  });

  await trail(
    { entityType: 'MsaStudy', entityId: created.id, action: 'CREATE', newValue: `${studyNo} — ${instrument.code}` },
    userId,
  );
  return serializeStudy(created);
};

/** Trials are replaced wholesale — a half-updated matrix computes nonsense. */
export const saveTrials = async (id: string, input: SaveMsaTrialsInput, userId?: string) => {
  const study = await load(id);
  if (study.approvedAt) throw BadRequest('An approved study cannot be modified');

  const seen = new Set<string>();
  for (const t of input.trials) {
    const key = `${t.part_no}:${t.operator}:${t.trial}`;
    if (seen.has(key)) throw BadRequest(`Duplicate trial for part ${t.part_no}, operator ${t.operator}, trial ${t.trial}`);
    seen.add(key);
  }

  await prisma.$transaction([
    prisma.msaTrial.deleteMany({ where: { studyId: id } }),
    prisma.msaTrial.createMany({
      data: input.trials.map((t) => ({
        studyId: id,
        partNo: t.part_no,
        operator: t.operator,
        trial: t.trial,
        measured: t.measured,
      })),
    }),
  ]);

  await trail(
    { entityType: 'MsaStudy', entityId: id, action: 'UPDATE', field: 'trials', newValue: `${input.trials.length} measurement(s)` },
    userId,
  );
  return serializeStudy(await load(id));
};

export const computeStudy = async (id: string, userId?: string) => {
  const study = await load(id);
  if (study.approvedAt) throw BadRequest('An approved study cannot be recomputed');
  if (study.trials.length === 0) throw BadRequest('Enter trial measurements before computing');

  const result = computeGrr(
    study.trials.map((t) => ({
      partNo: t.partNo,
      operator: t.operator,
      trial: t.trial,
      measured: Number(t.measured),
    })),
    num(study.toleranceUsed),
  );

  const updated = await prisma.msaStudy.update({
    where: { id },
    data: {
      repeatabilityEv: result.ev,
      reproducibilityAv: result.av,
      grr: result.grr,
      partVariation: result.pv,
      totalVariation: result.tv,
      grrPercent: result.grrPercent,
      ndc: result.ndc,
      verdict: result.verdict,
    },
    include: INCLUDE,
  });

  await trail(
    {
      entityType: 'MsaStudy',
      entityId: id,
      action: 'UPDATE',
      field: 'verdict',
      newValue: `%GRR ${result.grrPercent.toFixed(2)} — ${result.verdict} (ndc ${result.ndc})`,
    },
    userId,
  );
  return serializeStudy(updated);
};

export const approveStudy = async (id: string, userId?: string) => {
  const study = await load(id);
  if (study.approvedAt) throw BadRequest('This study is already approved');
  if (!study.verdict) throw BadRequest('Compute the study before approving it');

  const updated = await prisma.msaStudy.update({
    where: { id },
    data: { approvedById: userId ?? null, approvedAt: new Date() },
    include: INCLUDE,
  });

  await trail(
    {
      entityType: 'MsaStudy',
      entityId: id,
      action: 'APPROVE',
      newValue: `${study.studyNo} — ${study.verdict}`,
      reason: `%GRR ${num(study.grrPercent)?.toFixed(2) ?? 'n/a'}`,
    },
    userId,
  );
  return serializeStudy(updated);
};

export const deleteStudy = async (id: string, userId?: string) => {
  const study = await load(id);
  if (study.approvedAt) throw BadRequest('An approved study cannot be deleted');
  await prisma.msaStudy.update({ where: { id }, data: { isDeleted: true } });
  await trail({ entityType: 'MsaStudy', entityId: id, action: 'DELETE', oldValue: study.studyNo }, userId);
};
