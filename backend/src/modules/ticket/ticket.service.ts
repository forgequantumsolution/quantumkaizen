import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Forbidden, NotFound } from '../../lib/httpError';
import {
  raiseTicket as engineRaiseTicket,
  getCurrentStageActions as engineGetActions,
  performAction as engineTransition,
  holdTicket as engineHold,
  resumeTicket as engineResume,
} from '../workflow/engine/orchestrator';
import { emitAuditEvent } from '../workflow/engine/audit.emitter';
import type { TicketTypeScope, SiteScope } from '../../middleware/permissions';
import { siteFilterFor } from '../../middleware/permissions';
import type {
  AddCommentInput,
  AttachDocInput,
  HoldBody,
  ListCommentsQuery,
  ListTicketsQuery,
  RaiseTicketInput,
  SpawnChildInput,
  TransitionBody,
  UpdateTicketInput,
} from './ticket.schema';

const ticketSummarySelect = {
  id: true,
  uniqueId: true,
  title: true,
  isOnHold: true,
  isDeleted: true,
  dueDate: true,
  classification: true,
  createdAt: true,
  updatedAt: true,
  priority: { select: { id: true, name: true } },
  severity: { select: { id: true, name: true, level: true, color: true } },
  department: { select: { id: true, name: true, code: true } },
  site: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  flows: {
    select: {
      id: true,
      isCompleted: true,
      isRejected: true,
      workflowId: true,
      workflowName: true,
      workflowVersion: true,
      currentStages: { select: { id: true, name: true, canonicalId: true, stageType: true } },
    },
  },
} satisfies Prisma.TicketSelect;

const ticketDetailSelect = {
  id: true,
  uniqueId: true,
  title: true,
  description: true,
  ticketReason: true,
  customFields: true,
  isOnHold: true,
  holdReason: true,
  heldAt: true,
  isDeleted: true,
  deletedAt: true,
  dueDate: true,
  classification: true,
  createdAt: true,
  updatedAt: true,
  priority: { select: { id: true, name: true } },
  severity: { select: { id: true, name: true, level: true, color: true } },
  department: { select: { id: true, name: true, code: true } },
  site: { select: { id: true, name: true, code: true } },
  parentTicket: { select: { id: true, uniqueId: true, title: true } },
  parentTicketStage: { select: { id: true, name: true, canonicalId: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  heldBy: { select: { id: true, name: true } },
  flows: {
    select: {
      id: true,
      isCompleted: true,
      isRejected: true,
      rejectedAt: true,
      completedAt: true,
      statusUpdatedAt: true,
      workflow: { select: { id: true, name: true, version: true, typeId: true } },
      workflowName: true,
      workflowVersion: true,
      currentStages: {
        select: {
          id: true,
          name: true,
          canonicalId: true,
          stageType: true,
        },
      },
    },
  },
} satisfies Prisma.TicketSelect;

// ─── List / Get ─────────────────────────────────────────────────────────────

export const list = async (
  query: ListTicketsQuery,
  userId: string,
  scope: TicketTypeScope = { all: false, typeIds: [] },
  siteScope: SiteScope = { all: true, siteIds: [] },
) => {
  const where: Prisma.TicketWhereInput = {};
  if (query.includeDeleted !== 'true') where.isDeleted = false;

  // Per-site scoping: constrain to the sites the caller may see, intersected
  // with any navbar site selection. viewAll + no selection → no constraint.
  const siteWhere = siteFilterFor(siteScope, query.siteId);
  if (siteWhere) where.siteId = siteWhere;
  const flowsSome: Prisma.TicketFlowWhereInput = {};
  if (query.workflowId) flowsSome.workflowId = query.workflowId;
  if (query.workflowTypeId) flowsSome.workflow = { typeId: query.workflowTypeId };
  if (query.status === 'open') flowsSome.isCompleted = false;
  if (query.status === 'completed') flowsSome.isCompleted = true;

  // Per-type scoping: always restrict to the workflow types the user can read
  // (SUPER_ADMIN holds every `wf_type.*.read` key, so `scope.typeIds` covers
  // all of them). A request for a specific, unreadable type returns an empty
  // page rather than leaking counts.
  if (query.workflowTypeId) {
    if (!scope.typeIds.includes(query.workflowTypeId)) {
      return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    }
  } else {
    flowsSome.workflow = { typeId: { in: scope.typeIds } };
  }

  if (Object.keys(flowsSome).length > 0) where.flows = { some: flowsSome };
  if (query.mine === 'true') where.createdById = userId;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { uniqueId: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: ticketSummarySelect,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  // Direct-child counts for this page's tickets (one groupBy) so the list can
  // show an expander on parents. Children may be a different workflow type
  // (e.g. a CAPA raised from a Change Control ticket) and thus not in this list.
  const pageIds = items.map((t) => t.id);
  const childGroups = pageIds.length
    ? await prisma.ticket.groupBy({
        by: ['parentTicketId'],
        where: { parentTicketId: { in: pageIds }, isDeleted: false },
        _count: { _all: true },
      })
    : [];
  const childCountByParent = new Map(
    childGroups.map((g) => [g.parentTicketId as string, g._count._all]),
  );

  return {
    items: items.map((t) => ({
      ...t,
      childCount: childCountByParent.get(t.id) ?? 0,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
};

export const getById = async (id: string) => {
  const t = await prisma.ticket.findUnique({
    where: { id },
    select: ticketDetailSelect,
  });
  if (!t) throw NotFound('Ticket not found');
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
    heldAt: t.heldAt ? t.heldAt.toISOString() : null,
    flows: t.flows.map((f) => ({
      ...f,
      completedAt: f.completedAt ? f.completedAt.toISOString() : null,
      rejectedAt: f.rejectedAt ? f.rejectedAt.toISOString() : null,
      statusUpdatedAt: f.statusUpdatedAt.toISOString(),
    })),
  };
};

// ─── Create / Update / Delete ───────────────────────────────────────────────

export const raiseTicket = async (input: RaiseTicketInput, userId: string) => {
  const { ticketId, flowId, uniqueId } = await engineRaiseTicket(input, { id: userId });
  return { ticketId, flowId, uniqueId };
};

export const update = async (id: string, input: UpdateTicketInput) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { isDeleted: true },
  });
  if (!ticket) throw NotFound('Ticket not found');
  if (ticket.isDeleted) throw BadRequest('Ticket is deleted');

  const data: Prisma.TicketUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.ticketReason !== undefined) data.ticketReason = input.ticketReason;
  if (input.priorityId !== undefined) {
    data.priority = input.priorityId
      ? { connect: { id: input.priorityId } }
      : { disconnect: true };
  }
  if (input.departmentId !== undefined) {
    data.department = input.departmentId
      ? { connect: { id: input.departmentId } }
      : { disconnect: true };
  }
  if (input.siteId !== undefined) {
    data.site = input.siteId
      ? { connect: { id: input.siteId } }
      : { disconnect: true };
  }
  if (input.severityId !== undefined) {
    data.severity = input.severityId
      ? { connect: { id: input.severityId } }
      : { disconnect: true };
  }
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  }
  if (input.classification !== undefined) {
    data.classification = input.classification ?? null;
  }
  if (input.customFields !== undefined) {
    data.customFields = (input.customFields as Prisma.InputJsonValue) ?? Prisma.JsonNull;
  }

  return prisma.ticket.update({
    where: { id },
    data,
    select: ticketDetailSelect,
  });
};

export const softDelete = async (id: string, userId: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, isDeleted: true },
  });
  if (!ticket) throw NotFound('Ticket not found');
  if (ticket.isDeleted) throw BadRequest('Ticket already deleted');
  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: userId,
      },
    });
    await emitAuditEvent(tx, { ticketId: id }, 'TICKET_DELETED', {}, { id: userId });
  });
};

// ─── Engine pass-through ────────────────────────────────────────────────────

export const allowedActions = async (ticketId: string, userId: string) =>
  engineGetActions(ticketId, { id: userId });

export const transition = async (
  ticketId: string,
  body: TransitionBody,
  userId: string
) => engineTransition(ticketId, body.actionId, { id: userId }, body);

export const hold = async (ticketId: string, body: HoldBody, userId: string) =>
  engineHold(ticketId, body.reason, { id: userId });

export const resume = async (ticketId: string, userId: string) =>
  engineResume(ticketId, { id: userId });

// ─── Tracking / Timeline ────────────────────────────────────────────────────

export const track = async (ticketId: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });
  if (!ticket) throw NotFound('Ticket not found');
  const rows = await prisma.ticketStageTracking.findMany({
    where: { ticketId },
    orderBy: { enteredAt: 'asc' },
    select: {
      id: true,
      stageId: true,
      stageName: true,
      enteredAt: true,
      exitedAt: true,
      durationSec: true,
      isActive: true,
      isOnHold: true,
      holdReason: true,
      remarks: true,
      performedBy: { select: { id: true, name: true, email: true } },
      postAction: {
        select: {
          id: true,
          workflowAction: { select: { name: true, behavior: true } },
        },
      },
      returnedFromStage: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    enteredAt: r.enteredAt.toISOString(),
    exitedAt: r.exitedAt ? r.exitedAt.toISOString() : null,
  }));
};

export const timeline = async (ticketId: string) => {
  const [tracks, comments] = await Promise.all([
    prisma.ticketStageTracking.findMany({
      where: { ticketId },
      orderBy: { enteredAt: 'asc' },
      select: {
        id: true,
        stageName: true,
        enteredAt: true,
        exitedAt: true,
        isActive: true,
        performedBy: { select: { id: true, name: true } },
        postAction: { select: { workflowAction: { select: { name: true } } } },
      },
    }),
    prisma.ticketComment.findMany({
      where: { ticketId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    }),
  ]);

  type Entry =
    | { kind: 'stage_entered'; at: string; stageName: string; performedBy: { id: string; name: string } | null }
    | { kind: 'stage_exited'; at: string; stageName: string; actionName: string | null; performedBy: { id: string; name: string } | null }
    | { kind: 'comment'; at: string; body: string; author: { id: string; name: string } | null };

  const entries: Entry[] = [];
  for (const t of tracks) {
    entries.push({
      kind: 'stage_entered',
      at: t.enteredAt.toISOString(),
      stageName: t.stageName,
      performedBy: t.performedBy,
    });
    if (t.exitedAt && !t.isActive) {
      entries.push({
        kind: 'stage_exited',
        at: t.exitedAt.toISOString(),
        stageName: t.stageName,
        actionName: t.postAction?.workflowAction.name ?? null,
        performedBy: t.performedBy,
      });
    }
  }
  for (const c of comments) {
    entries.push({
      kind: 'comment',
      at: c.createdAt.toISOString(),
      body: c.body,
      author: c.author,
    });
  }
  entries.sort((a, b) => a.at.localeCompare(b.at));
  return entries;
};

export const participants = async (ticketId: string) => {
  const [tracks, comments] = await Promise.all([
    prisma.ticketStageTracking.findMany({
      where: { ticketId, performedById: { not: null } },
      select: { performedBy: { select: { id: true, name: true, email: true } } },
      distinct: ['performedById'],
    }),
    prisma.ticketComment.findMany({
      where: { ticketId, authorId: { not: null }, isDeleted: false },
      select: { author: { select: { id: true, name: true, email: true } } },
      distinct: ['authorId'],
    }),
  ]);
  const map = new Map<string, { id: string; name: string; email: string }>();
  for (const t of tracks) if (t.performedBy) map.set(t.performedBy.id, t.performedBy);
  for (const c of comments) if (c.author) map.set(c.author.id, c.author);
  return Array.from(map.values());
};

// ─── Comments ───────────────────────────────────────────────────────────────

export const addComment = async (
  ticketId: string,
  input: AddCommentInput,
  userId: string
) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { isDeleted: true },
  });
  if (!ticket) throw NotFound('Ticket not found');
  if (ticket.isDeleted) throw BadRequest('Ticket is deleted');
  return prisma.ticketComment.create({
    data: {
      ticketId,
      body: input.body,
      authorId: userId,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });
};

export const listComments = async (ticketId: string, query: ListCommentsQuery) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });
  if (!ticket) throw NotFound('Ticket not found');
  const [items, total] = await Promise.all([
    prisma.ticketComment.findMany({
      where: { ticketId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.ticketComment.count({ where: { ticketId, isDeleted: false } }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
};

export const deleteComment = async (
  ticketId: string,
  commentId: string,
  userId: string,
  isAdmin: boolean
) => {
  const c = await prisma.ticketComment.findUnique({
    where: { id: commentId },
    select: { ticketId: true, authorId: true, isDeleted: true },
  });
  if (!c || c.ticketId !== ticketId) throw NotFound('Comment not found');
  if (c.isDeleted) throw BadRequest('Comment already deleted');
  if (c.authorId !== userId && !isAdmin) {
    throw Forbidden('You can only delete your own comments');
  }
  await prisma.ticketComment.update({
    where: { id: commentId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
};

// ─── Docs ───────────────────────────────────────────────────────────────────

export const attachDoc = async (
  ticketId: string,
  input: AttachDocInput,
  userId: string
) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { isDeleted: true },
  });
  if (!ticket) throw NotFound('Ticket not found');
  if (ticket.isDeleted) throw BadRequest('Ticket is deleted');
  return prisma.ticketDoc.create({
    data: {
      ticketId,
      stageId: input.stageId ?? null,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      docType: input.docType ?? 'ATTACHMENT',
      uploadedById: userId,
    },
    select: {
      id: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      fileSizeBytes: true,
      docType: true,
      stageId: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  });
};

export const listDocs = async (ticketId: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });
  if (!ticket) throw NotFound('Ticket not found');
  return prisma.ticketDoc.findMany({
    where: { ticketId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      fileSizeBytes: true,
      docType: true,
      stageId: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  });
};

export const deleteDoc = async (
  ticketId: string,
  docId: string
) => {
  const d = await prisma.ticketDoc.findUnique({
    where: { id: docId },
    select: { ticketId: true, isDeleted: true },
  });
  if (!d || d.ticketId !== ticketId) throw NotFound('Document not found');
  if (d.isDeleted) throw BadRequest('Document already deleted');
  await prisma.ticketDoc.update({
    where: { id: docId },
    data: { isDeleted: true },
  });
};

// ─── Spawn child ────────────────────────────────────────────────────────────

// Resolve a workflow id to its lineage root + latest active version. Workflows
// re-version on every builder save (new id each time), so a stored reference
// must be resolved to the current version before raising. Returns null if the
// workflow is gone.
const workflowLineage = async (
  workflowId: string,
): Promise<{ rootId: string; latestId: string } | null> => {
  const wf = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, parentWorkflowId: true },
  });
  if (!wf) return null;
  const rootId = wf.parentWorkflowId ?? wf.id;
  const latest = await prisma.workflow.findFirst({
    where: {
      isLatestVersion: true,
      isDeleted: false,
      OR: [{ id: rootId }, { parentWorkflowId: rootId }],
    },
    select: { id: true },
  });
  return latest ? { rootId, latestId: latest.id } : null;
};

export const spawnChild = async (
  parentTicketId: string,
  input: SpawnChildInput,
  userId: string
) => {
  const parent = await prisma.ticket.findUnique({
    where: { id: parentTicketId },
    select: { isDeleted: true },
  });
  if (!parent) throw NotFound('Parent ticket not found');
  if (parent.isDeleted) throw BadRequest('Parent ticket is deleted');

  // Enforce a stage's `allowMultiple=false` trigger: if a matching child (same
  // stage, same workflow lineage) already exists, block the second raise. Only
  // applies when raising from a configured stage trigger — findings-driven
  // spawns (no matching trigger) are unaffected.
  if (input.parentStageId) {
    const lineage = await workflowLineage(input.childWorkflowId);
    const rootId = lineage?.rootId ?? input.childWorkflowId;
    const lineageWhere = { OR: [{ id: rootId }, { parentWorkflowId: rootId }] };
    const trigger = await prisma.childWorkflowTrigger.findFirst({
      where: { parentStageId: input.parentStageId, childWorkflow: lineageWhere },
      select: { allowMultiple: true },
    });
    if (trigger && !trigger.allowMultiple) {
      const existing = await prisma.ticket.findFirst({
        where: {
          parentTicketId,
          isDeleted: false,
          parentTicketStageId: input.parentStageId,
          flows: { some: { workflow: lineageWhere } },
        },
        select: { id: true },
      });
      if (existing) {
        throw BadRequest(
          'A child ticket for this workflow has already been raised from this stage',
        );
      }
    }
  }

  const result = await engineRaiseTicket(
    {
      workflowId: input.childWorkflowId,
      title: input.title,
      description: input.description,
      parentTicketId,
      parentTicketStageId: input.parentStageId ?? null,
    },
    { id: userId }
  );
  await prisma.$transaction(async (tx) => {
    await emitAuditEvent(
      tx,
      { ticketId: parentTicketId },
      'CHILD_TICKET_SPAWNED',
      { childTicketId: result.ticketId, childWorkflowId: input.childWorkflowId },
      { id: userId }
    );
  });
  return result;
};

// ─── Children ───────────────────────────────────────────────────────────────
// Direct child tickets of a ticket (one level), for the "Child records" view.
// A child that backs a first-class CAPA is flagged so the UI can deep-link to
// the CAPA workspace instead of the generic ticket page.
export const listChildren = async (parentTicketId: string) => {
  const children = await prisma.ticket.findMany({
    where: { parentTicketId, isDeleted: false },
    select: {
      id: true,
      uniqueId: true,
      title: true,
      sourceFindingId: true,
      flows: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: {
          isCompleted: true,
          workflow: { select: { name: true, type: { select: { name: true } } } },
          currentStages: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Which of these tickets are CAPA workflow tickets → map to their Capa id.
  const ids = children.map((c) => c.id);
  const capas = ids.length
    ? await prisma.capa.findMany({
        where: { workflowTicketId: { in: ids } },
        select: { id: true, capaNumber: true, workflowTicketId: true },
      })
    : [];
  const capaByTicketId = new Map(capas.map((c) => [c.workflowTicketId as string, c]));

  return {
    data: children.map((c) => {
      const capa = capaByTicketId.get(c.id) ?? null;
      const flow = c.flows[0];
      return {
        id: c.id,
        unique_id: c.uniqueId,
        title: c.title,
        module: flow?.workflow.type?.name ?? flow?.workflow.name ?? null,
        stage: flow?.isCompleted
          ? 'Completed'
          : flow?.currentStages.map((s) => s.name).join(', ') || null,
        source_finding_id: c.sourceFindingId,
        capa_id: capa?.id ?? null,
        capa_number: capa?.capaNumber ?? null,
      };
    }),
  };
};

// ─── Stage child-workflow triggers (runtime "Raise child" options) ────────────
// For the ticket's CURRENT stage(s), return the MANUAL child-workflow triggers
// configured on those stages — each resolved to the child workflow's latest
// version (workflows re-version on save). `already_raised` reflects the
// allowMultiple=false gate so the UI can disable an already-used trigger.
export const listStageChildTriggers = async (ticketId: string) => {
  const flow = await prisma.ticketFlow.findFirst({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    select: {
      isCompleted: true,
      currentStages: { select: { id: true, name: true } },
    },
  });
  if (!flow || flow.isCompleted) return { data: [] };
  const stageIds = flow.currentStages.map((s) => s.id);
  if (stageIds.length === 0) return { data: [] };
  const stageNameById = new Map(flow.currentStages.map((s) => [s.id, s.name]));

  const triggers = await prisma.childWorkflowTrigger.findMany({
    where: { parentStageId: { in: stageIds }, triggerMode: 'MANUAL' },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      parentStageId: true,
      childWorkflowId: true,
      isBlocking: true,
      allowMultiple: true,
      order: true,
      childWorkflow: { select: { parentWorkflowId: true } },
    },
  });
  if (triggers.length === 0) return { data: [] };

  // Existing children of this ticket → the (parentStageId, lineage-root) pairs
  // already raised, for the allowMultiple gate.
  const existingChildren = await prisma.ticket.findMany({
    where: { parentTicketId: ticketId, isDeleted: false, parentTicketStageId: { in: stageIds } },
    select: {
      parentTicketStageId: true,
      flows: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: { workflow: { select: { id: true, parentWorkflowId: true } } },
      },
    },
  });
  const raisedKeys = new Set(
    existingChildren
      .map((c) => {
        const wf = c.flows[0]?.workflow;
        if (!wf || !c.parentTicketStageId) return null;
        return `${c.parentTicketStageId}::${wf.parentWorkflowId ?? wf.id}`;
      })
      .filter((k): k is string => k !== null),
  );

  const data = [];
  for (const t of triggers) {
    const rootId = t.childWorkflow.parentWorkflowId ?? t.childWorkflowId;
    const latest = await prisma.workflow.findFirst({
      where: {
        isLatestVersion: true,
        isDeleted: false,
        OR: [{ id: rootId }, { parentWorkflowId: rootId }],
      },
      select: { id: true, name: true, type: { select: { name: true } } },
    });
    if (!latest) continue; // child workflow deleted → not raiseable
    data.push({
      id: t.id,
      parent_stage_id: t.parentStageId,
      stage_name: stageNameById.get(t.parentStageId) ?? null,
      child_workflow_id: latest.id,
      child_workflow_name: latest.name,
      child_module: latest.type?.name ?? null,
      is_blocking: t.isBlocking,
      allow_multiple: t.allowMultiple,
      order: t.order,
      already_raised: !t.allowMultiple && raisedKeys.has(`${t.parentStageId}::${rootId}`),
    });
  }
  return { data };
};

