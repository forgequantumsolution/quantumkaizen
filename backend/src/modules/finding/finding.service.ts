import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound, BadRequest } from '../../lib/httpError';
import { createCapa } from '../audit/capa.service';
import { spawnChild } from '../ticket/ticket.service';
import type {
  FindingUpsertInput,
  FindingUpdateInput,
  ListFindingQuery,
  RaiseChildInput,
} from './finding.schema';

// ── numbering ──
const nextFindingNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await prisma.finding.count({
    where: { findingNumber: { startsWith: `F-${year}-` } },
  });
  return `F-${year}-${String(count + 1).padStart(4, '0')}`;
};

// ── serializers ──
type FindingRow = Prisma.FindingGetPayload<{
  include: {
    sourceTicket: {
      select: {
        id: true;
        uniqueId: true;
        title: true;
        department: { select: { id: true; name: true } };
      };
    };
    createdBy: { select: { id: true; name: true } };
  };
}>;

const serialize = (f: FindingRow) => ({
  id: f.id,
  finding_number: f.findingNumber,
  source_ticket_id: f.sourceTicketId,
  source_stage_id: f.sourceStageId,
  severity: f.severity,
  status: f.status,
  title: f.title,
  description: f.description,
  recommendation: f.recommendation,
  reference: f.reference,
  evidence: f.evidence,
  is_generated: !!(f.evidence as { dedupeKey?: string } | null)?.dedupeKey,
  source_ticket: f.sourceTicket
    ? {
        id: f.sourceTicket.id,
        unique_id: f.sourceTicket.uniqueId,
        title: f.sourceTicket.title,
        department: f.sourceTicket.department,
      }
    : null,
  created_by: f.createdBy,
  created_at: f.createdAt,
  updated_at: f.updatedAt,
});

const includeRow = {
  sourceTicket: {
    select: {
      id: true,
      uniqueId: true,
      title: true,
      department: { select: { id: true, name: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.FindingInclude;

// ── list (per-ticket + per-module register) ──
export const listFindingsForTicket = async (ticketId: string) => {
  const items = await prisma.finding.findMany({
    where: { sourceTicketId: ticketId },
    include: includeRow,
    orderBy: { createdAt: 'desc' },
  });
  return { data: items.map(serialize) };
};

export const listFindings = async (q: ListFindingQuery) => {
  const where: Prisma.FindingWhereInput = {
    sourceTicket: { isDeleted: false },
  };
  if (q.source_ticket_id) where.sourceTicketId = q.source_ticket_id;
  if (q.status) where.status = q.status;
  if (q.severity) where.severity = q.severity;
  // Scope to a module (WorkflowType) via the source ticket's flow, and optional dept.
  const ticketWhere = where.sourceTicket as Prisma.TicketWhereInput;
  if (q.workflow_type_id) {
    ticketWhere.flows = { some: { workflow: { typeId: q.workflow_type_id } } };
  }
  if (q.department_id) ticketWhere.departmentId = q.department_id;

  const [total, items] = await Promise.all([
    prisma.finding.count({ where }),
    prisma.finding.findMany({
      where,
      include: includeRow,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);
  return { data: items.map(serialize), total, page: q.page, page_size: q.page_size };
};

// ── manual CRUD (fallback) ──
export const createFinding = async (input: FindingUpsertInput, userId?: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: input.source_ticket_id },
    select: { id: true, isDeleted: true },
  });
  if (!ticket || ticket.isDeleted) throw NotFound('Source ticket not found');
  const finding = await prisma.finding.create({
    data: {
      findingNumber: await nextFindingNumber(),
      sourceTicketId: input.source_ticket_id,
      sourceStageId: input.source_stage_id ?? null,
      severity: input.severity,
      status: input.status ?? 'OPEN',
      title: input.title,
      description: input.description,
      recommendation: input.recommendation ?? null,
      reference: input.reference ?? null,
      evidence: (input.evidence ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      createdById: userId ?? null,
    },
    include: includeRow,
  });
  return serialize(finding);
};

export const updateFinding = async (id: string, input: FindingUpdateInput) => {
  const existing = await prisma.finding.findUnique({ where: { id } });
  if (!existing) throw NotFound('Finding not found');
  const finding = await prisma.finding.update({
    where: { id },
    data: {
      severity: input.severity ?? undefined,
      status: input.status ?? undefined,
      title: input.title ?? undefined,
      description: input.description ?? undefined,
      recommendation: input.recommendation === undefined ? undefined : input.recommendation,
      reference: input.reference === undefined ? undefined : input.reference,
      sourceStageId: input.source_stage_id === undefined ? undefined : input.source_stage_id,
    },
    include: includeRow,
  });
  return serialize(finding);
};

export const deleteFinding = async (id: string) => {
  const existing = await prisma.finding.findUnique({ where: { id } });
  if (!existing) throw NotFound('Finding not found');
  await prisma.finding.delete({ where: { id } });
};

// ── raise a child ticket (CAPA / Deviation) from a finding ──
const resolveActiveWorkflowIdByTypeName = async (name: string): Promise<string | null> => {
  const wf = await prisma.workflow.findFirst({
    where: {
      isDeleted: false,
      workflowStatus: 'ACTIVE',
      type: { name },
    },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  return wf?.id ?? null;
};

export const raiseChild = async (
  findingId: string,
  input: RaiseChildInput,
  userId: string,
) => {
  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    select: {
      id: true,
      findingNumber: true,
      title: true,
      description: true,
      sourceTicketId: true,
    },
  });
  if (!finding) throw NotFound('Finding not found');

  const title = input.title?.trim() || `${finding.findingNumber} — ${finding.title}`;
  const description = input.description ?? finding.description;

  if (input.child_type === 'CAPA') {
    // Rich path: first-class Capa + its spawned CAPA workflow ticket, nested
    // under the source ticket and linked back to this finding.
    const capa = await createCapa(
      {
        title,
        description,
        type: input.capa_type ?? 'CORRECTIVE',
        finding_id: finding.id,
        parent_ticket_id: finding.sourceTicketId,
        owner_id: input.owner_id ?? null,
        department_id: input.department_id ?? null,
        due_date: input.due_date ?? null,
        non_conformance_id: null,
      },
      userId,
    );
    return { child_type: 'CAPA', capa };
  }

  // DEVIATION: plain child ticket via the engine.
  const childWorkflowId = await resolveActiveWorkflowIdByTypeName('Deviation');
  if (!childWorkflowId) {
    throw BadRequest('No active Deviation workflow is published');
  }
  const child = await spawnChild(
    finding.sourceTicketId,
    { childWorkflowId, title, description },
    userId,
  );
  await prisma.ticket.update({
    where: { id: child.ticketId },
    data: { sourceFindingId: finding.id },
  });
  return { child_type: 'DEVIATION', ticket: child };
};

// ── children of a finding (CAPAs + raised tickets) ──
export const listFindingChildren = async (findingId: string) => {
  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding) throw NotFound('Finding not found');

  const [capas, tickets] = await Promise.all([
    prisma.capa.findMany({
      where: { findingId },
      select: { id: true, capaNumber: true, title: true, status: true, workflowTicketId: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ticket.findMany({
      where: { sourceFindingId: findingId, isDeleted: false },
      select: {
        id: true,
        uniqueId: true,
        title: true,
        flows: { take: 1, orderBy: { createdAt: 'asc' }, select: { workflow: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // A CAPA's own workflow ticket also appears in `tickets` — drop it so a CAPA
  // isn't listed twice (once as Capa, once as its ticket).
  const capaTicketIds = new Set(capas.map((c) => c.workflowTicketId).filter(Boolean));
  return {
    data: {
      capas: capas.map((c) => ({
        id: c.id,
        capa_number: c.capaNumber,
        title: c.title,
        status: c.status,
        workflow_ticket_id: c.workflowTicketId,
      })),
      tickets: tickets
        .filter((t) => !capaTicketIds.has(t.id))
        .map((t) => ({
          id: t.id,
          unique_id: t.uniqueId,
          title: t.title,
          module: t.flows[0]?.workflow.name ?? null,
        })),
    },
  };
};
