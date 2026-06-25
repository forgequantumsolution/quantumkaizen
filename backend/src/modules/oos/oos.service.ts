/**
 * LIMS 2.0 — L4 OOS/OOT investigation. Raised (often automatically) from an
 * out-of-spec result and progressed through Phase 1A (lab investigation) →
 * Phase 1B → Phase 2, then closed with a classification and optional CAPA link.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail, recordSignature } from '../audit/compliance.service';
import type { OpenInvestigationInput, UpdateInvestigationInput, AdvancePhaseInput, CloseInvestigationInput, ListInvestigationQuery } from './oos.schema';

const PHASES = ['PHASE_1A', 'PHASE_1B', 'PHASE_2', 'CLOSED'];

const nextCode = async () => `OOS-${new Date().getFullYear()}-${String((await prisma.oosInvestigation.count()) + 1).padStart(4, '0')}`;

const serialize = (o: Prisma.OosInvestigationGetPayload<object>) => ({
  id: o.id, code: o.code, title: o.title, sample_id: o.sampleId, sample_test_id: o.sampleTestId, result_id: o.resultId,
  phase: o.phase, status: o.status, classification: o.classification, hypothesis: o.hypothesis,
  investigation_summary: o.investigationSummary, retest_required: o.retestRequired, resample_required: o.resampleRequired,
  conclusion: o.conclusion, capa_id: o.capaId, opened_at: o.openedAt, closed_at: o.closedAt, created_at: o.createdAt, updated_at: o.updatedAt,
});

/** Called automatically from result entry, and manually via the controller. */
export const openInvestigation = async (input: OpenInvestigationInput, userId?: string) => {
  // De-dupe: don't open a second open investigation for the same result.
  if (input.result_id) {
    const existing = await prisma.oosInvestigation.findFirst({ where: { resultId: input.result_id, status: { not: 'CLOSED' } } });
    if (existing) return serialize(existing);
  }
  const code = await nextCode();
  const o = await prisma.oosInvestigation.create({
    data: {
      code, title: input.title, sampleId: input.sample_id ?? null, sampleTestId: input.sample_test_id ?? null,
      resultId: input.result_id ?? null, phase: 'PHASE_1A', status: 'OPEN', openedById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'OosInvestigation', entityId: o.id, action: 'CREATE', newValue: code }, userId);
  return serialize(o);
};

export const listInvestigations = async (q: ListInvestigationQuery) => {
  const where: Prisma.OosInvestigationWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.phase) where.phase = q.phase;
  if (q.sample_id) where.sampleId = q.sample_id;
  if (q.search) where.OR = [{ code: { contains: q.search, mode: 'insensitive' } }, { title: { contains: q.search, mode: 'insensitive' } }];
  const rows = await prisma.oosInvestigation.findMany({ where, orderBy: { createdAt: 'desc' }, take: q.page_size ?? 200 });
  return { data: rows.map(serialize) };
};

const get = async (id: string) => {
  const o = await prisma.oosInvestigation.findUnique({ where: { id } });
  if (!o) throw NotFound('Investigation not found');
  return o;
};
export const getInvestigation = async (id: string) => serialize(await get(id));

export const updateInvestigation = async (id: string, input: UpdateInvestigationInput, userId?: string) => {
  const o = await get(id);
  if (o.status === 'CLOSED') throw BadRequest('Investigation is closed');
  const u = await prisma.oosInvestigation.update({
    where: { id },
    data: {
      title: input.title ?? o.title, hypothesis: input.hypothesis ?? o.hypothesis,
      investigationSummary: input.investigation_summary ?? o.investigationSummary,
      retestRequired: input.retest_required ?? o.retestRequired, resampleRequired: input.resample_required ?? o.resampleRequired,
      classification: input.classification ?? o.classification, status: o.status === 'OPEN' ? 'IN_PROGRESS' : o.status,
    },
  });
  await writeTrail({ entityType: 'OosInvestigation', entityId: id, action: 'UPDATE' }, userId);
  return serialize(u);
};

export const advancePhase = async (id: string, input: AdvancePhaseInput, userId?: string) => {
  const o = await get(id);
  if (o.status === 'CLOSED') throw BadRequest('Investigation is closed');
  const cur = PHASES.indexOf(o.phase);
  const next = PHASES.indexOf(input.phase);
  if (next < 0 || next <= cur) throw BadRequest(`Cannot move from ${o.phase} to ${input.phase}`);
  const u = await prisma.oosInvestigation.update({ where: { id }, data: { phase: input.phase, status: 'IN_PROGRESS', investigationSummary: input.investigation_summary ?? o.investigationSummary } });
  await writeTrail({ entityType: 'OosInvestigation', entityId: id, action: 'TRANSITION', field: 'phase', oldValue: o.phase, newValue: input.phase, reason: input.remarks ?? undefined }, userId);
  return serialize(u);
};

export const closeInvestigation = async (id: string, input: CloseInvestigationInput, userId?: string) => {
  const o = await get(id);
  if (o.status === 'CLOSED') throw BadRequest('Already closed');
  if (input.credential) await recordSignature({ entity_type: 'OosInvestigation', entity_id: id, meaning: `OOS closure: ${input.classification}`, credential: input.credential }, userId);
  const u = await prisma.oosInvestigation.update({
    where: { id },
    data: { status: 'CLOSED', phase: 'CLOSED', classification: input.classification, conclusion: input.conclusion ?? o.conclusion, capaId: input.capa_id ?? o.capaId, closedById: userId ?? null, closedAt: new Date() },
  });
  await writeTrail({ entityType: 'OosInvestigation', entityId: id, action: 'TRANSITION', field: 'classification', newValue: input.classification, reason: input.conclusion ?? undefined }, userId);
  return serialize(u);
};
