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

// Next sequence number derived from the highest EXISTING value — not a row
// count, which collides the moment any earlier row is deleted and leaves a gap.
const nextNumber = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: { findFirst: (args: any) => Promise<any> },
  field: string,
  prefix: string,
  year: number,
): Promise<string> => {
  const latest = await model.findFirst({
    where: { [field]: { startsWith: `${prefix}-${year}-` } },
    orderBy: { [field]: 'desc' },
    select: { [field]: true },
  });
  const parsed = latest ? Number(String(latest[field]).split('-').pop()) : 0;
  const max = Number.isFinite(parsed) ? parsed : 0;
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
};

// Retry a create whose generated number can still race with a concurrent insert.
// `run` regenerates the number on each attempt so the retry picks a fresh value.
const withUniqueRetry = async <T>(run: () => Promise<T>, tries = 5): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      const isDup =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
      if (!isDup || attempt >= tries - 1) throw e;
    }
  }
};

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
    findingId?: string | null;
    // When raised from a generic finding, nest the CAPA's workflow ticket under
    // the source module ticket so it shows as a child there.
    parentTicketId?: string | null;
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
      parentTicketId: capa.parentTicketId ?? undefined,
      customFields: {
        capa_id: capa.id,
        capa_number: capa.capaNumber,
        non_conformance_id: capa.nonConformanceId ?? null,
        finding_id: capa.findingId ?? null,
      },
    },
    { id: userId },
  );
  // Link the spawned CAPA workflow ticket back to its origin finding so the
  // finding's children query and the source ticket's child list resolve it.
  if (capa.findingId) {
    await prisma.ticket.update({
      where: { id: t.ticketId },
      data: { sourceFindingId: capa.findingId },
    });
  }
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

// Sync the CAPA linked to a given workflow ticket. Called by the workflow engine
// after a transition so the CAPA's status mirror / closedAt / NC roll-up track
// the ticket immediately — not only when the CAPA detail page is opened.
// Best-effort and a no-op when no CAPA is bound to the ticket.
export const syncCapaFromTicketId = async (ticketId: string): Promise<void> => {
  const capa = await prisma.capa.findFirst({
    where: { workflowTicketId: ticketId },
    select: {
      id: true,
      status: true,
      workflowTicketId: true,
      implementedAt: true,
      nonConformanceId: true,
    },
  });
  if (capa) await syncCapaStatusFromTicket(capa);
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
  source: c.source,
  source_ref: c.sourceRef,
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

// Every CAPA raised from a non-conformance of a given audit register — i.e. the
// audit ticket's "child" corrective actions, so the parent audit can surface
// all of them in one place regardless of how many were raised.
export const listCapasForRegister = async (registerId: string) => {
  const items = await prisma.capa.findMany({
    where: { nonConformance: { finding: { program: { registerId } } } },
    include: capaInclude,
    orderBy: { createdAt: 'desc' },
  });
  return { data: items.map(serializeCapa) };
};

export const listCapas = async (q: ListCapaQuery) => {
  const where: Prisma.CapaWhereInput = {};
  /**
   * Origin filter. Four modules raise CAPAs into this one register, so a view
   * that does not filter shows every other module's work — the Audit CAPA tab
   * was listing risk-driven and OOS CAPAs alongside its own.
   * Comma-separated; omitted means every source.
   */
  if (q.source) {
    const list = q.source
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean) as Prisma.EnumCapaSourceFilter['in'];
    if (list && (list as string[]).length) where.source = { in: list };
  }
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
  const [items, total] = await Promise.all([
    prisma.capa.findMany({
      where,
      include: capaInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
    prisma.capa.count({ where }),
  ]);
  return {
    data: items.map(serializeCapa),
    pagination: { total_items: total, page: q.page, page_size: q.page_size },
  };
};

// Fishbone categories — kept in sync with the frontend capa/capaData.ts.
const FISHBONE_CATEGORIES = ['Man', 'Machine', 'Material', 'Method', 'Measurement', 'Environment'];

const flattenResponses = (responses: unknown): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (responses && typeof responses === 'object') {
    for (const section of Object.values(responses as Record<string, unknown>)) {
      if (section && typeof section === 'object') Object.assign(out, section as Record<string, unknown>);
    }
  }
  return out;
};
const asStr = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const asRows = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];

// The live CAPA workflow's forms are authored in the form builder, so their
// template keys are per-environment UUIDs — recognise the RCA form by its
// response shape instead of its key.
const isBuilderRca = (r: Record<string, unknown>) =>
  '5_why_analysis' in r || 'fishbone_ishikawa_worksheet' in r || 'root_cause_s_identified' in r;

// Builder RCA form → RootCauseData. 5-why rows carry a question/observation and
// a root-cause answer; the fishbone worksheet is a table of
// { category: 'Man / People', potential_cause_s } rows whose category labels
// prefix-match the bespoke tab's Ishikawa categories.
const mapBuilderRca = (r: Record<string, unknown>) => {
  const whyRows = asRows(r['5_why_analysis']);
  const fiveWhys = Array.from({ length: 5 }, (_, i) => {
    const row = whyRows[i] ?? {};
    return [asStr(row.question_observation).trim(), asStr(row.root_cause_answer).trim()]
      .filter(Boolean)
      .join(' → ');
  });
  const fishbone: Record<string, string[]> = {};
  for (const c of FISHBONE_CATEGORIES) fishbone[c] = [];
  for (const row of asRows(r.fishbone_ishikawa_worksheet)) {
    const label = asStr(row.category).toLowerCase();
    const cat = FISHBONE_CATEGORIES.find((c) => label.startsWith(c.toLowerCase()));
    const cause = asStr(row.potential_cause_s ?? row.potential_cause).trim();
    if (cat && cause) fishbone[cat].push(cause);
  }
  return { fiveWhys, fishbone, conclusion: asStr(r.root_cause_s_identified) };
};

// Mirror the submitted CAPA workflow forms (Root Cause Analysis + Effectiveness
// Verification) into the structured shapes the bespoke tabs render, so a CAPA
// driven through the workflow auto-fills its fishbone + 30/60/90 views without
// double entry. Returns nulls when the relevant form hasn't been submitted.
const deriveCapaFormData = async (
  ticketId: string,
): Promise<{ rootCauseData: unknown | null; effectivenessData: unknown | null }> => {
  const subs = await prisma.formSubmission.findMany({
    where: { ticketId, status: 'SUBMITTED' },
    orderBy: { submittedAt: 'desc' },
    select: { responses: true, form: { select: { templateKey: true } } },
  });
  const flat = subs.map((s) => ({
    key: s.form.templateKey,
    r: flattenResponses(s.responses),
  }));
  const rca = flat.find((s) => s.key === 'capa-rca');
  const rcaBuilder = flat.find((s) => isBuilderRca(s.r));
  const eff = flat.find((s) => s.key === 'capa-effectiveness');

  let rootCauseData: unknown | null = null;
  if (rca) {
    const r = rca.r;
    const fishbone: Record<string, string[]> = {};
    for (const c of FISHBONE_CATEGORIES) fishbone[c] = [];
    const category = asStr(r.rootCauseCategory);
    const cause = asStr(r.confirmedRootCause).trim();
    if (FISHBONE_CATEGORIES.includes(category) && cause) fishbone[category] = [cause];
    rootCauseData = {
      fiveWhys: [r.why1, r.why2, r.why3, r.why4, r.why5].map(asStr),
      fishbone,
      conclusion: asStr(r.confirmedRootCause),
    };
  } else if (rcaBuilder) {
    rootCauseData = mapBuilderRca(rcaBuilder.r);
  }

  let effectivenessData: unknown | null = null;
  if (eff) {
    const r = eff.r;
    const norm = (v: unknown): 'pending' | 'pass' | 'fail' => {
      const s = String(v ?? '').toLowerCase();
      return s === 'pass' || s === 'fail' ? s : 'pending';
    };
    effectivenessData = {
      checkIns: [
        { day: 30, status: norm(r.check30), notes: asStr(r.verificationMethod) },
        { day: 60, status: norm(r.check60), notes: '' },
        { day: 90, status: norm(r.check90), notes: asStr(r.effectivenessConclusion) },
      ],
    };
  }
  return { rootCauseData, effectivenessData };
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
  const serialized = serializeCapa(c);
  // Workflow-driven CAPAs mirror their Root Cause / Effectiveness stage forms
  // into the bespoke tabs (rendered read-only on the client).
  if (c.workflowTicketId) {
    const derived = await deriveCapaFormData(c.workflowTicketId);
    if (derived.rootCauseData) serialized.root_cause_data = derived.rootCauseData;
    if (derived.effectivenessData) serialized.effectiveness_data = derived.effectivenessData;
  }
  return serialized;
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

  const capa = await withUniqueRetry(async () => {
    const capaNumber = await nextNumber(prisma.capa, 'capaNumber', 'CAPA', year);
    return prisma.$transaction(async (tx) => {
      const created = await tx.capa.create({
        data: {
          // Declared by the caller. Inferred for legacy callers that pass
          // neither: an NC link means audit, a finding link means finding.
          source:
            input.source ??
            (input.non_conformance_id ? 'AUDIT' : input.finding_id ? 'FINDING' : 'MANUAL'),
          sourceRef: input.source_ref ?? null,
          capaNumber,
          title: input.title,
          description: input.description ?? null,
          type: input.type,
          nonConformanceId: input.non_conformance_id ?? null,
          findingId: input.finding_id ?? null,
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
      await raiseCapaWorkflowTicket(
        { ...capa, parentTicketId: input.parent_ticket_id ?? null },
        userId,
      );
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
  const [items, total] = await Promise.all([
    prisma.actionItem.findMany({
      where,
      include: actionInclude,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
    prisma.actionItem.count({ where }),
  ]);
  return {
    data: items.map(serializeAction),
    pagination: { total_items: total, page: q.page, page_size: q.page_size },
  };
};

export const createActionItem = async (input: ActionItemUpsertInput, userId?: string) => {
  const year = new Date().getFullYear();
  const created = await withUniqueRetry(async () => {
    const actionNumber = await nextNumber(prisma.actionItem, 'actionNumber', 'AI', year);
    return prisma.actionItem.create({
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
