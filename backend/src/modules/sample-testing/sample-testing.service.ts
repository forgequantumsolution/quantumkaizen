/**
 * LIMS 2.0 — M-LIMS-B core testing (L2–L5).
 *  L2  assign tests to a sample (from a panel / the product's default panel),
 *      binding the spec version effective at login.
 *  L3  worklists/batches, dynamic result entry with automatic PASS/OOS
 *      evaluation against the bound spec line, second-person e-signed review.
 *  L5  e-signed sample disposition (release / reject), status derived from tests.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail, recordSignature } from '../audit/compliance.service';
import { openInvestigation } from '../oos/oos.service';
import type {
  AssignTestsInput, EnterResultsInput, ReviewTestInput, DisposeSampleInput,
  WorklistUpsertInput, ListSampleTestQuery, ListWorklistQuery,
} from './sample-testing.schema';

// ── evaluation ──────────────────────────────────────────────────────────────
const round = (v: number, decimals?: number | null) =>
  decimals == null ? v : Number(v.toFixed(decimals));

/** Auto-evaluate a numeric value against snapshotted spec limits. */
export const evaluateValue = (numeric: number | null, text: string | null, min: number | null, max: number | null, decimals?: number | null) => {
  if (numeric == null && (text == null || text === '')) return { evaluation: 'PENDING' as const, isOutOfSpec: false };
  if (numeric == null) return { evaluation: 'NA' as const, isOutOfSpec: false }; // text-only result
  const v = round(numeric, decimals);
  let oos = false;
  if (min != null && v < min) oos = true;
  if (max != null && v > max) oos = true;
  return { evaluation: oos ? ('OOS' as const) : ('PASS' as const), isOutOfSpec: oos };
};

// ── L2: resolve the effective spec version for a sample ──────────────────────
const effectiveSpecVersion = async (productId: string | null, stage = 'RELEASE') => {
  if (!productId) return null;
  const candidates = await prisma.specVersion.findMany({
    where: { productId, status: 'APPROVED', isDeleted: false },
    include: { lines: { orderBy: { sequence: 'asc' } } },
    orderBy: { version: 'desc' },
  });
  return candidates.find((c) => c.stage === stage) ?? candidates[0] ?? null;
};

type SpecLine = { id: string; name: string; unit: string | null; minValue: number | null; maxValue: number | null; decimals: number | null };
const matchLine = (lines: SpecLine[], analyteName: string) =>
  lines.find((l) => l.name.trim().toLowerCase() === analyteName.trim().toLowerCase()) ?? null;

/** L2 — assign tests to a sample and pre-create their analyte result rows. */
export const assignTests = async (sampleId: string, input: AssignTestsInput, userId?: string) => {
  const sample = await prisma.sample.findFirst({ where: { id: sampleId, isDeleted: false } });
  if (!sample) throw NotFound('Sample not found');

  // Resolve the test-definition ids to assign.
  let testDefIds = input.test_definition_ids ?? [];
  const panelId = input.panel_id ?? (input.from_product ? await productDefaultPanel(sample.productId) : null);
  if (panelId) {
    const items = await prisma.testPanelItem.findMany({ where: { panelId }, orderBy: { sequence: 'asc' } });
    testDefIds = [...new Set([...testDefIds, ...items.map((i) => i.testDefinitionId)])];
  }
  if (!testDefIds.length) throw BadRequest('No tests to assign (provide test_definition_ids, panel_id, or a product with a default panel)');

  const defs = await prisma.testDefinition.findMany({ where: { id: { in: testDefIds }, isDeleted: false }, include: { analytes: { orderBy: { sequence: 'asc' } } } });
  const spec = await effectiveSpecVersion(sample.productId);
  const lines = (spec?.lines ?? []) as unknown as SpecLine[];

  const created = await prisma.$transaction(async (tx) => {
    const out: string[] = [];
    for (const def of defs) {
      const st = await tx.sampleTest.create({
        data: {
          sampleId, testDefinitionId: def.id, testName: def.name,
          specVersionId: spec?.id ?? null, status: 'PENDING', createdById: userId ?? null,
          results: {
            create: def.analytes.map((a) => {
              const line = matchLine(lines, a.name);
              return {
                analyteName: a.name, unit: a.unit ?? line?.unit ?? null, specLineId: line?.id ?? null,
                minValue: line?.minValue ?? null, maxValue: line?.maxValue ?? null,
                decimals: a.decimals ?? line?.decimals ?? null, calculation: a.calculation ?? null,
                evaluation: 'PENDING', enteredById: null,
              };
            }),
          },
        },
      });
      out.push(st.id);
    }
    return out;
  });

  if (spec && sample.specVersionId !== spec.id) await prisma.sample.update({ where: { id: sampleId }, data: { specVersionId: spec.id } });
  await writeTrail({ entityType: 'Sample', entityId: sampleId, action: 'UPDATE', field: 'tests', newValue: `Assigned ${created.length} test(s)` }, userId);
  return { assigned: created.length, spec_version: spec ? { id: spec.id, code: spec.code, name: spec.name } : null };
};

const productDefaultPanel = async (productId: string | null) => {
  if (!productId) return null;
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { defaultPanelId: true } });
  return p?.defaultPanelId ?? null;
};

// ── serialization ────────────────────────────────────────────────────────────
type STRow = Prisma.SampleTestGetPayload<{ include: { results: true } }>;
const serializeResult = (r: STRow['results'][number]) => ({
  id: r.id, analyte_name: r.analyteName, unit: r.unit, numeric_value: r.numericValue, text_value: r.textValue,
  evaluation: r.evaluation, is_out_of_spec: r.isOutOfSpec, min_value: r.minValue, max_value: r.maxValue,
  decimals: r.decimals, calculation: r.calculation, entered_at: r.enteredAt,
});
const serializeTest = (t: STRow, extra: Record<string, unknown> = {}) => ({
  id: t.id, sample_id: t.sampleId, test_definition_id: t.testDefinitionId, test_name: t.testName,
  spec_version_id: t.specVersionId, worklist_id: t.worklistId, status: t.status, overall_result: t.overallResult,
  analyst_name: t.analystName, instrument_id: t.instrumentId, started_at: t.startedAt, completed_at: t.completedAt,
  review_status: t.reviewStatus, reviewed_by_id: t.reviewedById, reviewed_at: t.reviewedAt,
  results: t.results.map(serializeResult), created_at: t.createdAt, ...extra,
});

export const getSampleTest = async (id: string) => {
  const t = await prisma.sampleTest.findUnique({ where: { id }, include: { results: true } });
  if (!t) throw NotFound('Sample test not found');
  return serializeTest(t);
};

export const listSampleTests = async (q: ListSampleTestQuery) => {
  const where: Prisma.SampleTestWhereInput = {};
  if (q.sample_id) where.sampleId = q.sample_id;
  if (q.worklist_id) where.worklistId = q.worklist_id;
  if (q.status) where.status = q.status;
  if (q.review_status) where.reviewStatus = q.review_status;
  const rows = await prisma.sampleTest.findMany({ where, include: { results: true }, orderBy: { createdAt: 'desc' }, take: q.page_size ?? 200 });
  return { data: rows.map((t) => serializeTest(t)) };
};

export const getTestsForSample = async (sampleId: string) => {
  const rows = await prisma.sampleTest.findMany({ where: { sampleId }, include: { results: true }, orderBy: { createdAt: 'asc' } });
  return { data: rows.map((t) => serializeTest(t)) };
};

// ── L3: result entry + auto evaluation ───────────────────────────────────────
export const enterResults = async (sampleTestId: string, input: EnterResultsInput, userId?: string) => {
  const test = await prisma.sampleTest.findUnique({ where: { id: sampleTestId }, include: { results: true } });
  if (!test) throw NotFound('Sample test not found');
  if (test.reviewStatus === 'APPROVED') throw BadRequest('Reviewed tests are locked');
  const byId = new Map(test.results.map((r) => [r.id, r]));

  const oosResultIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const r of input.results) {
      const existing = byId.get(r.result_id);
      if (!existing) continue;
      const numeric = r.numeric_value ?? null;
      const text = r.text_value ?? null;
      const { evaluation, isOutOfSpec } = evaluateValue(numeric, text, existing.minValue, existing.maxValue, existing.decimals);
      await tx.result.update({ where: { id: r.result_id }, data: { numericValue: numeric, textValue: text, evaluation, isOutOfSpec, instrumentId: input.instrument_id ?? existing.instrumentId, enteredById: userId ?? null } });
      if (isOutOfSpec) oosResultIds.push(r.result_id);
    }
    // Recompute test rollup.
    const after = await tx.result.findMany({ where: { sampleTestId } });
    const entered = after.filter((r) => r.numericValue != null || (r.textValue && r.textValue !== ''));
    const anyOos = after.some((r) => r.isOutOfSpec);
    const allEntered = entered.length === after.length && after.length > 0;
    await tx.sampleTest.update({
      where: { id: sampleTestId },
      data: {
        analystName: input.analyst_name ?? test.analystName, analystId: userId ?? test.analystId,
        instrumentId: input.instrument_id ?? test.instrumentId,
        startedAt: test.startedAt ?? new Date(),
        status: allEntered ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: allEntered ? new Date() : null,
        overallResult: allEntered ? (anyOos ? 'OOS' : 'PASS') : null,
      },
    });
  });

  await writeTrail({ entityType: 'SampleTest', entityId: sampleTestId, action: 'UPDATE', field: 'results', newValue: oosResultIds.length ? `OOS x${oosResultIds.length}` : 'entered' }, userId);

  // L4 — auto-raise an OOS investigation for the first breach.
  if (oosResultIds.length) {
    await openInvestigation({ sample_id: test.sampleId, sample_test_id: sampleTestId, result_id: oosResultIds[0], title: `OOS — ${test.testName}` }, userId).catch(() => undefined);
  }
  return getSampleTest(sampleTestId);
};

// ── L3: second-person e-signed review ────────────────────────────────────────
export const reviewTest = async (sampleTestId: string, input: ReviewTestInput, userId?: string) => {
  const test = await prisma.sampleTest.findUnique({ where: { id: sampleTestId } });
  if (!test) throw NotFound('Sample test not found');
  if (test.status !== 'COMPLETED' && input.decision === 'APPROVED') throw BadRequest('Only completed tests can be approved');
  if (test.analystId && test.analystId === userId) throw BadRequest('Second-person review: the analyst cannot review their own test');
  if (input.credential) await recordSignature({ entity_type: 'SampleTest', entity_id: sampleTestId, meaning: `Test review: ${input.decision}`, credential: input.credential }, userId);
  await prisma.sampleTest.update({ where: { id: sampleTestId }, data: { reviewStatus: input.decision, reviewedById: userId ?? null, reviewedAt: new Date(), status: input.decision === 'APPROVED' ? 'REVIEWED' : test.status } });
  await writeTrail({ entityType: 'SampleTest', entityId: sampleTestId, action: 'TRANSITION', field: 'reviewStatus', newValue: input.decision, reason: input.remarks ?? undefined }, userId);
  return getSampleTest(sampleTestId);
};

// ── L5: e-signed sample disposition ──────────────────────────────────────────
export const disposeSample = async (sampleId: string, input: DisposeSampleInput, userId?: string) => {
  const sample = await prisma.sample.findFirst({ where: { id: sampleId, isDeleted: false }, include: { sampleTests: true } });
  if (!sample) throw NotFound('Sample not found');
  if (sample.disposition) throw BadRequest(`Sample already ${sample.disposition}`);
  if (input.disposition === 'RELEASED') {
    if (!sample.sampleTests.length) throw BadRequest('No tests to release against');
    const unreviewed = sample.sampleTests.filter((t) => t.reviewStatus !== 'APPROVED');
    if (unreviewed.length) throw BadRequest(`${unreviewed.length} test(s) not yet review-approved`);
    const failed = sample.sampleTests.filter((t) => t.overallResult === 'OOS' || t.overallResult === 'FAIL');
    if (failed.length) throw BadRequest('Cannot release: out-of-spec results present');
  }
  if (input.credential) await recordSignature({ entity_type: 'Sample', entity_id: sampleId, meaning: `Sample disposition: ${input.disposition}`, credential: input.credential }, userId);
  await prisma.sample.update({
    where: { id: sampleId },
    data: {
      disposition: input.disposition, status: input.disposition === 'RELEASED' ? 'RELEASED' : 'REJECTED',
      releasedById: userId ?? null, releasedAt: new Date(), reviewedById: userId ?? null, reviewedAt: new Date(), remarks: input.reason ?? sample.remarks,
    },
  });
  await writeTrail({ entityType: 'Sample', entityId: sampleId, action: 'TRANSITION', field: 'disposition', newValue: input.disposition, reason: input.reason ?? undefined }, userId);
  return prisma.sample.findUnique({ where: { id: sampleId } }).then((s) => ({ id: s!.id, sample_number: s!.sampleNumber, status: s!.status, disposition: s!.disposition }));
};

// ── L3: worklists / batches ──────────────────────────────────────────────────
const nextWorklistCode = async () => `WL-${new Date().getFullYear()}-${String((await prisma.worklist.count()) + 1).padStart(4, '0')}`;
const serializeWorklist = (w: Prisma.WorklistGetPayload<object>, tests = 0) => ({
  id: w.id, code: w.code, name: w.name, status: w.status, analyst_name: w.analystName, instrument_id: w.instrumentId,
  system_suitability: w.systemSuitability, notes: w.notes, test_count: tests, created_at: w.createdAt, updated_at: w.updatedAt,
});

export const listWorklists = async (q: ListWorklistQuery) => {
  const where: Prisma.WorklistWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.search) where.OR = [{ code: { contains: q.search, mode: 'insensitive' } }, { name: { contains: q.search, mode: 'insensitive' } }];
  const rows = await prisma.worklist.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { tests: true } } } });
  return { data: rows.map((w) => serializeWorklist(w, w._count.tests)) };
};

export const getWorklist = async (id: string) => {
  const w = await prisma.worklist.findFirst({ where: { id, isDeleted: false } });
  if (!w) throw NotFound('Worklist not found');
  const tests = await prisma.sampleTest.findMany({ where: { worklistId: id }, include: { results: true } });
  const sampleIds = [...new Set(tests.map((t) => t.sampleId))];
  const samples = sampleIds.length ? await prisma.sample.findMany({ where: { id: { in: sampleIds } }, select: { id: true, sampleNumber: true, productName: true } }) : [];
  const sm = new Map(samples.map((s) => [s.id, s]));
  return { ...serializeWorklist(w, tests.length), tests: tests.map((t) => serializeTest(t, { sample_number: sm.get(t.sampleId)?.sampleNumber ?? null, product_name: sm.get(t.sampleId)?.productName ?? null })) };
};

export const createWorklist = async (input: WorklistUpsertInput, userId?: string) => {
  const code = await nextWorklistCode();
  const w = await prisma.worklist.create({ data: { code, name: input.name, analystName: input.analyst_name ?? null, instrumentId: input.instrument_id ?? null, notes: input.notes ?? null, createdById: userId ?? null } });
  if (input.sample_test_ids?.length) await prisma.sampleTest.updateMany({ where: { id: { in: input.sample_test_ids } }, data: { worklistId: w.id } });
  await writeTrail({ entityType: 'Worklist', entityId: w.id, action: 'CREATE', newValue: code }, userId);
  return getWorklist(w.id);
};

export const updateWorklist = async (id: string, input: WorklistUpsertInput, userId?: string) => {
  const w = await prisma.worklist.findFirst({ where: { id, isDeleted: false } });
  if (!w) throw NotFound('Worklist not found');
  await prisma.worklist.update({ where: { id }, data: { name: input.name ?? w.name, analystName: input.analyst_name ?? w.analystName, instrumentId: input.instrument_id ?? w.instrumentId, systemSuitability: input.system_suitability ?? w.systemSuitability, notes: input.notes ?? w.notes, status: input.status ?? w.status } });
  if (input.sample_test_ids) await prisma.sampleTest.updateMany({ where: { id: { in: input.sample_test_ids } }, data: { worklistId: id } });
  await writeTrail({ entityType: 'Worklist', entityId: id, action: 'UPDATE' }, userId);
  return getWorklist(id);
};

export const removeTestFromWorklist = async (sampleTestId: string, userId?: string) => {
  await prisma.sampleTest.update({ where: { id: sampleTestId }, data: { worklistId: null } });
  await writeTrail({ entityType: 'SampleTest', entityId: sampleTestId, action: 'UPDATE', field: 'worklist', newValue: 'removed' }, userId);
};

export const closeWorklist = async (id: string, userId?: string) => {
  const w = await prisma.worklist.findFirst({ where: { id, isDeleted: false } });
  if (!w) throw NotFound('Worklist not found');
  await prisma.worklist.update({ where: { id }, data: { status: 'CLOSED' } });
  await writeTrail({ entityType: 'Worklist', entityId: id, action: 'UPDATE', field: 'status', newValue: 'CLOSED' }, userId);
  return getWorklist(id);
};
