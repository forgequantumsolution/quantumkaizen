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
import type { TicketTypeScope } from '../../middleware/permissions';
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
  scope: TicketTypeScope = { all: true, typeIds: [] },
) => {
  const where: Prisma.TicketWhereInput = {};
  if (query.includeDeleted !== 'true') where.isDeleted = false;
  const flowsSome: Prisma.TicketFlowWhereInput = {};
  if (query.workflowId) flowsSome.workflowId = query.workflowId;
  if (query.workflowTypeId) flowsSome.workflow = { typeId: query.workflowTypeId };
  if (query.status === 'open') flowsSome.isCompleted = false;
  if (query.status === 'completed') flowsSome.isCompleted = true;

  // Per-type scoping: unless the user holds the global `ticket.read` master,
  // restrict to the workflow types they can read. A request for a specific,
  // unreadable type returns an empty page rather than leaking counts.
  if (!scope.all) {
    if (query.workflowTypeId) {
      if (!scope.typeIds.includes(query.workflowTypeId)) {
        return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
      }
    } else {
      flowsSome.workflow = { typeId: { in: scope.typeIds } };
    }
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

  return {
    items: items.map((t) => ({
      ...t,
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

