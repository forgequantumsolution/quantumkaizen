import { Prisma, type CapaStatus, type NonConformanceStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound, Conflict } from '../../lib/httpError';
import { writeTrail } from './compliance.service';
import { raiseTicket as engineRaiseTicket } from '../workflow/engine/orchestrator';
import type {
  ActionItemUpsertInput,
  CapaCreateInput,
  CapaUpdateInput,
  ListActionItemQuery,
  ListCapaQuery,
  UpdateActionItemStatusInput,
  UpdateCapaStatusInput,
} from './audit.schema';

const jsonOrNull = (
  v: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue);

const nextSeq = (prefix: string, year: number, count: number) =>
  `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;

// CAPA status → the NC status it should drive the source non-conformance to.
const NC_STATUS_FOR_CAPA: Partial<Record<CapaStatus, NonConformanceStatus>> = {
  INVESTIGATION: 'IN_PROGRESS',
  PLAN: 'IN_PROGRESS',
  IMPLEMENTATION: 'IN_PROGRESS',
  VERIFICATION: 'VERIFICATION',
  CLOSED: 'CLOSED',
};

// Stage canonicalId (from the seeded "CAPA Handling v1" workflow) → the
// CapaStatus the derived-status mirror should reflect. Keeps the enum — which
// list filters, badges and NC-sync still rely on — in step with the ticket.
const CAPA_STATUS_FOR_STAGE: Record<string, CapaStatus> = {
  'capa-initiation': 'OPEN',
  'capa-investigation': 'INVESTIGATION',
  'capa-action-plan': 'PLAN',
  'capa-implementation': 'IMPLEMENTATION',
  'capa-verification': 'VERIFICATION',
  'capa-closure': 'CLOSED',
};

// Ordered CAPA lifecycle — used to pick the furthest stage when a ticket sits on
// several stages at once (parallel branches).
const CAPA_FLOW_ORDER: CapaStatus[] = [
  'OPEN',
  'INVESTIGATION',
  'PLAN',
  'IMPLEMENTATION',
  'VERIFICATION',
  'CLOSED',
];

// Resolve the current CAPA workflow (latest ACTIVE version of the "CAPA"
// WorkflowType). Returns null if none is published — raising a ticket is
// best-effort so CAPA creation never hard-depends on it.
const resolveCapaWorkflowId = async (): Promise<string | null> => {
  const wf = await prisma.workflow.findFirst({
    where: {
      type: { name: 'CAPA' },
      isLatestVersion: true,
      isDeleted: false,
      workflowStatus: 'ACTIVE',
    },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  return wf?.id ?? null;
};

// Raise the workflow ticket that drives a CAPA and persist the link back onto
// it. Returns the linkage, or null when no active CAPA workflow is published.
// Shared by create (best-effort) and the explicit attach endpoint.
const raiseCapaWorkflowTicket = async (
  capa: {
    id: string;
    capaNumber: string;
    title: string;
    description: string | null;
    departmentId: string | null;
    nonConformanceId: string | null;
  },
  userId: string,
): Promise<{ workflowId: string; ticketId: string; uniqueId: string } | null> => {
  const workflowId = await resolveCapaWorkflowId();
  if (!workflowId) return null;
  const t = await engineRaiseTicket(
    {
      workflowId,
      title: `${capa.capaNumber} — ${capa.title}`,
      description: capa.description ?? undefined,
      departmentId: capa.departmentId ?? undefined,
      customFields: {
        capa_id: capa.id,
        capa_number: capa.capaNumber,
        non_conformance_id: capa.nonConformanceId ?? null,
      },
    },
    { id: userId },
  );
  await prisma.capa.update({
    where: { id: capa.id },
    data: {
      workflowId,
      workflowTicketId: t.ticketId,
      workflowTicketUniqueId: t.uniqueId,
    },
  });
  return { workflowId, ticketId: t.ticketId, uniqueId: t.uniqueId };
};

// Map a ticket flow's current position to a CapaStatus: a completed flow is
// CLOSED; otherwise take the furthest current stage in the CAPA lifecycle.
const deriveCapaStatusFromFlow = (flow: {
  isCompleted: boolean;
  currentStages: { canonicalId: string }[];
}): CapaStatus | null => {
  if (flow.isCompleted) return 'CLOSED';
  let best: CapaStatus | null = null;
  for (const s of flow.currentStages) {
    const mapped = CAPA_STATUS_FOR_STAGE[s.canonicalId];
    if (!mapped) continue;
    if (best === null || CAPA_FLOW_ORDER.indexOf(mapped) > CAPA_FLOW_ORDER.indexOf(best)) {
      best = mapped;
    }
  }
  return best;
};

// Keep the CapaStatus mirror (and the source NC) in step with the workflow
// ticket driving the CAPA. No-op for CAPAs not bound to a workflow, and never
// overrides a manual CANCELLED. Returns true when it changed the CAPA so callers
// can refetch. The ticket owns the authoritative audit trail, so no CAPA trail
// entry is written here.
const syncCapaStatusFromTicket = async (capa: {
  id: string;
  status: CapaStatus;
  workflowTicketId: string | null;
  implementedAt: Date | null;
  nonConformanceId: string | null;
}): Promise<boolean> => {
  if (!capa.workflowTicketId || capa.status === 'CANCELLED') return false;
  const flow = await prisma.ticketFlow.findFirst({
    where: { ticketId: capa.workflowTicketId },
    orderBy: { createdAt: 'desc' },
    select: { isCompleted: true, currentStages: { select: { canonicalId: true } } },
  });
  if (!flow) return false;
  const target = deriveCapaStatusFromFlow(flow);
  if (!target || target === capa.status) return false;

  const now = new Date();
  const data: Prisma.CapaUpdateInput = { status: target };
  if (target === 'IMPLEMENTATION' && !capa.implementedAt) data.implementedAt = now;
  if (target === 'CLOSED') data.closedAt = now;

  await prisma.$transaction(async (tx) => {
    await tx.capa.update({ where: { id: capa.id }, data });
    const ncStatus = NC_STATUS_FOR_CAPA[target];
    if (capa.nonConformanceId && ncStatus) {
      await tx.nonConformance.update({
        where: { id: capa.nonConformanceId },
        data: { status: ncStatus, closedAt: ncStatus === 'CLOSED' ? now : null },
      });
    }
  });
  return true;
};

// ────────────────────── CAPA ──────────────────────

const capaInclude = {
  owner: { select: { id: true, name: true } },
  verifiedBy: { select: { id: true, name: true } },
  department: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true } },
  nonConformance: {
    select: {
      id: true,
      ncNumber: true,
      status: true,
      severity: true,
      finding: { select: { id: true, findingNumber: true, description: true } },
    },
  },
  _count: { select: { actionItems: true } },
} satisfies Prisma.CapaInclude;

type CapaRow = Prisma.CapaGetPayload<{ include: typeof capaInclude }>;

const serializeCapa = (c: CapaRow) => ({
  id: c.id,
  capa_number: c.capaNumber,
  type: c.type,
  status: c.status,
  title: c.title,
  description: c.description,
  non_conformance: c.nonConformance,
  root_cause: c.rootCause,
  root_cause_data: c.rootCauseData,
  corrective_action: c.correctiveAction,
  preventive_action: c.preventiveAction,
  owner: c.owner,
  department: c.department,
  due_date: c.dueDate,
  implemented_at: c.implementedAt,
  verified_by: c.verifiedBy,
  verified_at: c.verifiedAt,
  effectiveness_check: c.effectivenessCheck,
  effectiveness_due: c.effectivenessDue,
  effectiveness_data: c.effectivenessData,
  closed_at: c.closedAt,
  workflow_id: c.workflowId,
  workflow_ticket_id: c.workflowTicketId,
  workflow_ticket_unique_id: c.workflowTicketUniqueId,
  action_item_count: c._count.actionItems,
  created_by: c.createdBy,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

export const listCapas = async (q: ListCapaQuery) => {
  const where: Prisma.CapaWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.type) where.type = q.type;
  if (q.owner_id) where.ownerId = q.owner_id;
  if (q.department_id) where.departmentId = q.department_id;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { capaNumber: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const items = await prisma.capa.findMany({
    where,
    include: capaInclude,
    orderBy: { createdAt: 'desc' },
  });
  return { data: items.map(serializeCapa) };
};

export const getCapa = async (id: string) => {
  let c = await prisma.capa.findUnique({ where: { id }, include: capaInclude });
  if (!c) throw NotFound('CAPA not found');
  // Reconcile the derived status mirror with the workflow ticket (if any) so an
  // opened CAPA reflects transitions performed on the ticket engine.
  if (await syncCapaStatusFromTicket(c)) {
    c = await prisma.capa.findUnique({ where: { id }, include: capaInclude });
    if (!c) throw NotFound('CAPA not found');
  }
  return serializeCapa(c);
};

export const createCapa = async (input: CapaCreateInput, userId?: string) => {
  // If raised from an NC, ensure it isn't already linked to a first-class CAPA.
  if (input.non_conformance_id) {
    const nc = await prisma.nonConformance.findUnique({
      where: { id: input.non_conformance_id },
      include: { capa: true },
    });
    if (!nc) throw NotFound('Non-conformance not found');
    if (nc.capa) throw Conflict('This non-conformance already has a CAPA');
  }

  const year = new Date().getFullYear();
  const count = await prisma.capa.count({ where: { capaNumber: { startsWith: `CAPA-${year}-` } } });
  const capaNumber = nextSeq('CAPA', year, count);

  const capa = await prisma.$transaction(async (tx) => {
    const created = await tx.capa.create({
      data: {
        capaNumber,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        nonConformanceId: input.non_conformance_id ?? null,
        ownerId: input.owner_id ?? null,
        departmentId: input.department_id ?? null,
        dueDate: input.due_date ? new Date(input.due_date) : null,
        createdById: userId ?? null,
      },
    });
    if (input.non_conformance_id) {
      await tx.nonConformance.update({
        where: { id: input.non_conformance_id },
        data: { status: 'CAPA_RAISED' },
      });
    }
    return created;
  });
  await writeTrail(
    { entityType: 'Capa', entityId: capa.id, action: 'CREATE', newValue: capa.capaNumber },
    userId,
  );

  // Best-effort: raise a workflow ticket so the CAPA runs on the dynamic engine
  // (mirrors the AuditRegister spawn-and-link pattern). A missing or inactive
  // CAPA workflow must never block CAPA creation.
  if (userId) {
    try {
      await raiseCapaWorkflowTicket(capa, userId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[capa] failed to raise workflow ticket for ${capa.capaNumber}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return getCapa(capa.id);
};

// Attach the CAPA workflow to an existing CAPA that has none (e.g. records
// created before the workflow integration, or when creation raised no ticket).
export const attachCapaWorkflow = async (id: string, userId?: string) => {
  if (!userId) throw BadRequest('Authentication required');
  const capa = await prisma.capa.findUnique({ where: { id } });
  if (!capa) throw NotFound('CAPA not found');
  if (capa.workflowTicketId) throw BadRequest('This CAPA already runs on a workflow');
  // A freshly-raised ticket starts on the initial stage, which would drive the
  // status mirror back to OPEN — so only OPEN CAPAs may attach.
  if (capa.status !== 'OPEN') {
    throw BadRequest('Only OPEN CAPAs can be attached to a workflow');
  }
  const res = await raiseCapaWorkflowTicket(capa, userId);
  if (!res) throw BadRequest('No active CAPA workflow is published');
  return getCapa(id);
};

export const updateCapa = async (id: string, input: CapaUpdateInput) => {
  const existing = await prisma.capa.findUnique({ where: { id } });
  if (!existing) throw NotFound('CAPA not found');
  if (existing.status === 'CLOSED' || existing.status === 'CANCELLED') {
    throw BadRequest('Closed or cancelled CAPAs cannot be edited');
  }
  await prisma.capa.update({
    where: { id },
    data: {
      title: input.title ?? existing.title,
      description: input.description === undefined ? existing.description : input.description,
      type: input.type ?? existing.type,
      rootCause: input.root_cause === undefined ? existing.rootCause : input.root_cause,
      rootCauseData:
        input.root_cause_data === undefined
          ? existing.rootCauseData ?? Prisma.JsonNull
          : jsonOrNull(input.root_cause_data),
      correctiveAction:
        input.corrective_action === undefined ? existing.correctiveAction : input.corrective_action,
      preventiveAction:
        input.preventive_action === undefined ? existing.preventiveAction : input.preventive_action,
      ownerId: input.owner_id === undefined ? existing.ownerId : input.owner_id,
      departmentId: input.department_id === undefined ? existing.departmentId : input.department_id,
      dueDate:
        input.due_date === undefined
          ? existing.dueDate
          : input.due_date
            ? new Date(input.due_date)
            : null,
      effectivenessCheck:
        input.effectiveness_check === undefined
          ? existing.effectivenessCheck
          : input.effectiveness_check,
      effectivenessData:
        input.effectiveness_data === undefined
          ? existing.effectivenessData ?? Prisma.JsonNull
          : jsonOrNull(input.effectiveness_data),
      effectivenessDue:
        input.effectiveness_due === undefined
          ? existing.effectivenessDue
          : input.effectiveness_due
            ? new Date(input.effectiveness_due)
            : null,
    },
  });
  return getCapa(id);
};

export const updateCapaStatus = async (
  id: string,
  input: UpdateCapaStatusInput,
  userId?: string,
) => {
  const capa = await prisma.capa.findUnique({ where: { id } });
  if (!capa) throw NotFound('CAPA not found');

  const now = new Date();
  const data: Prisma.CapaUpdateInput = { status: input.status };
  if (input.status === 'IMPLEMENTATION' && !capa.implementedAt) data.implementedAt = now;
  if (input.status === 'CLOSED') {
    data.closedAt = now;
    if (!capa.verifiedById && userId) {
      data.verifiedBy = { connect: { id: userId } };
      data.verifiedAt = now;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.capa.update({ where: { id }, data });
    // Drive the source non-conformance to a matching state.
    const ncStatus = NC_STATUS_FOR_CAPA[input.status];
    if (capa.nonConformanceId && ncStatus) {
      await tx.nonConformance.update({
        where: { id: capa.nonConformanceId },
        data: {
          status: ncStatus,
          closedAt: ncStatus === 'CLOSED' ? now : null,
        },
      });
    }
  });
  await writeTrail(
    {
      entityType: 'Capa',
      entityId: id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: capa.status,
      newValue: input.status,
    },
    userId,
  );
  return getCapa(id);
};

export const deleteCapa = async (id: string) => {
  const c = await prisma.capa.findUnique({ where: { id } });
  if (!c) throw NotFound('CAPA not found');
  if (c.status !== 'OPEN' && c.status !== 'CANCELLED') {
    throw BadRequest('Only OPEN or CANCELLED CAPAs can be deleted');
  }
  await prisma.capa.delete({ where: { id } });
};

// ────────────────────── Action Items ──────────────────────

const actionInclude = {
  owner: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  capa: { select: { id: true, capaNumber: true, title: true } },
  nonConformance: { select: { id: true, ncNumber: true } },
  finding: { select: { id: true, findingNumber: true } },
} satisfies Prisma.ActionItemInclude;

type ActionRow = Prisma.ActionItemGetPayload<{ include: typeof actionInclude }>;

const serializeAction = (a: ActionRow) => ({
  id: a.id,
  action_number: a.actionNumber,
  title: a.title,
  description: a.description,
  status: a.status,
  priority: a.priority,
  owner: a.owner,
  due_date: a.dueDate,
  completed_at: a.completedAt,
  capa: a.capa,
  non_conformance: a.nonConformance,
  finding: a.finding,
  created_by: a.createdBy,
  created_at: a.createdAt,
  updated_at: a.updatedAt,
});

export const listActionItems = async (q: ListActionItemQuery) => {
  const where: Prisma.ActionItemWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.owner_id) where.ownerId = q.owner_id;
  if (q.capa_id) where.capaId = q.capa_id;
  if (q.non_conformance_id) where.nonConformanceId = q.non_conformance_id;
  if (q.finding_id) where.findingId = q.finding_id;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { actionNumber: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const items = await prisma.actionItem.findMany({
    where,
    include: actionInclude,
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  });
  return { data: items.map(serializeAction) };
};

export const createActionItem = async (input: ActionItemUpsertInput, userId?: string) => {
  const year = new Date().getFullYear();
  const count = await prisma.actionItem.count({
    where: { actionNumber: { startsWith: `AI-${year}-` } },
  });
  const actionNumber = nextSeq('AI', year, count);
  const created = await prisma.actionItem.create({
    data: {
      actionNumber,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'OPEN',
      priority: input.priority,
      ownerId: input.owner_id ?? null,
      dueDate: input.due_date ? new Date(input.due_date) : null,
      capaId: input.capa_id ?? null,
      nonConformanceId: input.non_conformance_id ?? null,
      findingId: input.finding_id ?? null,
      createdById: userId ?? null,
    },
    include: actionInclude,
  });
  return serializeAction(created);
};

export const updateActionItem = async (id: string, input: ActionItemUpsertInput) => {
  const existing = await prisma.actionItem.findUnique({ where: { id } });
  if (!existing) throw NotFound('Action item not found');
  const updated = await prisma.actionItem.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? existing.status,
      priority: input.priority,
      ownerId: input.owner_id ?? null,
      dueDate: input.due_date ? new Date(input.due_date) : null,
      capaId: input.capa_id ?? null,
      nonConformanceId: input.non_conformance_id ?? null,
      findingId: input.finding_id ?? null,
    },
    include: actionInclude,
  });
  return serializeAction(updated);
};

export const updateActionItemStatus = async (id: string, input: UpdateActionItemStatusInput) => {
  const a = await prisma.actionItem.findUnique({ where: { id } });
  if (!a) throw NotFound('Action item not found');
  const completed = input.status === 'DONE' || input.status === 'VERIFIED';
  const updated = await prisma.actionItem.update({
    where: { id },
    data: {
      status: input.status,
      completedAt: completed ? (a.completedAt ?? new Date()) : null,
    },
    include: actionInclude,
  });
  return serializeAction(updated);
};

export const deleteActionItem = async (id: string) => {
  const a = await prisma.actionItem.findUnique({ where: { id } });
  if (!a) throw NotFound('Action item not found');
  await prisma.actionItem.delete({ where: { id } });
};
