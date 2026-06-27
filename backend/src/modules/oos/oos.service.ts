/**
 * LIMS 2.0 — L4 OOS/OOT investigation. Raised (often automatically) from an
 * out-of-spec result and progressed through Phase 1A (lab investigation) →
 * Phase 1B → Phase 2, then closed with a classification and optional CAPA link.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { writeTrail, recordSignature } from '../audit/compliance.service';
import { createCapa } from '../audit/capa.service';
import { raiseTicket as engineRaiseTicket } from '../workflow/engine/orchestrator';
import type { OpenInvestigationInput, UpdateInvestigationInput, AdvancePhaseInput, CloseInvestigationInput, CreateCapaFromOosInput, ListInvestigationQuery } from './oos.schema';

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

// Enrich with the linked QMS CAPA's number/status + the CAPA workflow ticket (soft
// cross-module reads) so the LIMS UI can show labels + links in one call.
const withCapa = async (o: Prisma.OosInvestigationGetPayload<object>) => {
  const base = serialize(o);
  const capa = o.capaId
    ? await prisma.capa.findUnique({ where: { id: o.capaId }, select: { id: true, capaNumber: true, status: true } })
    : null;
  return {
    ...base,
    capa: capa ? { id: capa.id, capa_number: capa.capaNumber, status: capa.status } : null,
    capa_ticket: o.capaTicketId ? { id: o.capaTicketId, unique_id: o.capaTicketUniqueId } : null,
  };
};

export const getInvestigation = async (id: string) => withCapa(await get(id));

// Resolve the active CAPA workflow (latest version of WorkflowType "CAPA").
const findActiveCapaWorkflow = async () =>
  prisma.workflow.findFirst({
    where: { type: { name: 'CAPA' }, isLatestVersion: true, isDeleted: false, workflowStatus: 'ACTIVE' },
    orderBy: { version: 'desc' },
    select: { id: true },
  });

/**
 * LIMS → QMS bridge. From an OOS investigation, raise BOTH:
 *  - a standalone CAPA record (audit module), and
 *  - a ticket on the CAPA workflow (so it appears in the team's CAPA workflow),
 * linking both back to the investigation. The workflow ticket is best-effort:
 * a missing / non-ACTIVE CAPA workflow must not block CAPA creation.
 */
export const createCapaForInvestigation = async (
  id: string,
  input: CreateCapaFromOosInput,
  userId?: string,
) => {
  const o = await get(id);
  if (o.capaId) throw Conflict('This investigation already has a linked CAPA');

  const capa = await createCapa(
    {
      title: input.title ?? o.title,
      type: input.type ?? 'CORRECTIVE',
      description: `Raised from OOS investigation ${o.code}${o.title ? ` — ${o.title}` : ''}.`,
      owner_id: input.owner_id ?? null,
      due_date: input.due_date ?? null,
    },
    userId,
  );

  // Also raise a CAPA workflow ticket so it shows in the team's CAPA workflow.
  let ticket: { ticketId: string; uniqueId: string } | null = null;
  try {
    const wf = await findActiveCapaWorkflow();
    if (!wf) throw new Error('no ACTIVE CAPA workflow found');
    if (!userId) throw new Error('no actor to raise the CAPA ticket');
    const t = await engineRaiseTicket(
      {
        workflowId: wf.id,
        title: input.title ?? `CAPA — ${o.title}`,
        description: `Raised from OOS investigation ${o.code}. Linked CAPA record ${capa.capa_number}.`,
        dueDate: input.due_date ?? null,
        customFields: {
          oos_investigation_id: o.id,
          oos_code: o.code,
          capa_record_id: capa.id,
          capa_record_number: capa.capa_number,
          sample_id: o.sampleId,
        },
      },
      { id: userId },
    );
    ticket = { ticketId: t.ticketId, uniqueId: t.uniqueId };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[oos] CAPA record ${capa.capa_number} created but workflow ticket was not raised:`,
      e instanceof Error ? e.message : e,
    );
  }

  const updated = await prisma.oosInvestigation.update({
    where: { id },
    data: {
      capaId: capa.id,
      capaTicketId: ticket?.ticketId ?? null,
      capaTicketUniqueId: ticket?.uniqueId ?? null,
      status: o.status === 'OPEN' ? 'IN_PROGRESS' : o.status,
    },
  });
  await writeTrail(
    { entityType: 'OosInvestigation', entityId: id, action: 'UPDATE', field: 'capaId', newValue: `${capa.capa_number}${ticket ? ` / ${ticket.uniqueId}` : ''}` },
    userId,
  );
  return {
    investigation: await withCapa(updated),
    capa: { id: capa.id, capa_number: capa.capa_number },
    capa_ticket: ticket ? { id: ticket.ticketId, unique_id: ticket.uniqueId } : null,
  };
};

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
