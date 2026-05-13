/**
 * SLA module service.
 *
 * Surface:
 *   listPoliciesForWorkflow / getPolicy / createPolicy / updatePolicy / softDeletePolicy
 *   upsertThresholds / deleteThreshold
 *   listTimers / getTicketSla
 *   requestExtension / decideExtension
 *
 * NOTE: `SlaTimer` rows are NOT created here — they're spawned by the engine
 * when a ticket enters an SLA-tracked stage (lands in P3.5). This module ships
 * the admin (policy + threshold) surface, the read endpoints, and the
 * extension request/approve flow that mutates an existing timer.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import type {
  CreateSlaPolicyInput,
  DecideExtensionInput,
  ListTimersQuery,
  RequestExtensionInput,
  UpdateSlaPolicyInput,
  UpsertThresholdsInput,
} from './sla.schema';

// ─── Selects ───────────────────────────────────────────────────────────────

const policySelect = {
  id: true,
  parentStageId: true,
  duration: true,
  calendarId: true,
  escalationWorkflowId: true,
  pauseOnHold: true,
  pauseOnExtensionPending: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  parentStage: {
    select: {
      id: true,
      name: true,
      canonicalId: true,
      workflow: { select: { id: true, name: true } },
    },
  },
  calendar: { select: { id: true, name: true, timezone: true } },
  escalationWorkflow: { select: { id: true, name: true } },
  responsibleRoles: { select: { id: true, name: true } },
  responsibleUsers: { select: { id: true, name: true, email: true } },
  thresholds: {
    select: {
      id: true,
      name: true,
      percentage: true,
      targetSlaStageId: true,
      targetSlaStage: { select: { id: true, name: true, canonicalId: true } },
      notifyRoles: { select: { id: true, name: true } },
      notifyUsers: { select: { id: true, name: true, email: true } },
    },
    orderBy: { percentage: 'asc' } as const,
  },
} satisfies Prisma.SlaPolicySelect;

const timerEventSelect = {
  id: true,
  eventType: true,
  thresholdId: true,
  thresholdName: true,
  thresholdPercentage: true,
  extensionAmountSec: true,
  newDeadline: true,
  triggeredById: true,
  triggeredBy: { select: { id: true, name: true, email: true } },
  eventData: true,
  occurredAt: true,
} satisfies Prisma.SlaTimerEventSelect;

const timerSelect = {
  id: true,
  ticketId: true,
  stageId: true,
  policyId: true,
  escalationTicketId: true,
  status: true,
  startedAt: true,
  deadline: true,
  completedAt: true,
  elapsedBeforePauseSec: true,
  lastResumedAt: true,
  totalExtensionsSec: true,
  extensionCount: true,
  createdAt: true,
  updatedAt: true,
  stage: { select: { id: true, name: true, canonicalId: true } },
  policy: {
    select: {
      id: true,
      duration: true,
      pauseOnHold: true,
      calendar: { select: { id: true, name: true, timezone: true } },
    },
  },
  escalationTicket: { select: { id: true, uniqueId: true, title: true } },
} satisfies Prisma.SlaTimerSelect;

const extensionSelect = {
  id: true,
  timerId: true,
  requestedById: true,
  requestedBy: { select: { id: true, name: true, email: true } },
  approverId: true,
  approver: { select: { id: true, name: true, email: true } },
  status: true,
  reason: true,
  extensionSec: true,
  decidedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SlaExtensionSelect;

// ─── Internal validators ───────────────────────────────────────────────────

const assertStageBelongsTo = async (stageId: string, expectedWorkflowId?: string) => {
  const stage = await prisma.workflowStage.findUnique({
    where: { id: stageId },
    select: { id: true, workflowId: true, isDeleted: true },
  });
  if (!stage || stage.isDeleted) throw NotFound(`Stage ${stageId} not found`);
  if (expectedWorkflowId && stage.workflowId !== expectedWorkflowId) {
    throw BadRequest(`Stage ${stageId} does not belong to workflow ${expectedWorkflowId}`);
  }
  return stage;
};

const assertCalendarUsable = async (calendarId: string | null | undefined) => {
  if (!calendarId) return;
  const cal = await prisma.businessCalendar.findUnique({
    where: { id: calendarId },
    select: { id: true, isDeleted: true, isActive: true },
  });
  if (!cal || cal.isDeleted) throw NotFound(`Business calendar ${calendarId} not found`);
  if (!cal.isActive) throw BadRequest(`Business calendar ${calendarId} is inactive`);
};

const assertWorkflowUsable = async (workflowId: string | null | undefined) => {
  if (!workflowId) return;
  const wf = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, isDeleted: true, workflowStatus: true },
  });
  if (!wf || wf.isDeleted) throw NotFound(`Workflow ${workflowId} not found`);
};

// ─── SlaPolicy CRUD ────────────────────────────────────────────────────────

export const listPoliciesForWorkflow = async (
  workflowId: string,
  opts: { includeDeleted?: boolean } = {},
) => {
  const wf = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, isDeleted: true },
  });
  if (!wf || wf.isDeleted) throw NotFound(`Workflow ${workflowId} not found`);

  const where: Prisma.SlaPolicyWhereInput = {
    parentStage: { workflowId },
  };
  if (!opts.includeDeleted) where.isDeleted = false;

  return prisma.slaPolicy.findMany({
    where,
    orderBy: { parentStage: { name: 'asc' } },
    select: policySelect,
  });
};

export const getPolicy = async (id: string) => {
  const policy = await prisma.slaPolicy.findUnique({
    where: { id },
    select: policySelect,
  });
  if (!policy) throw NotFound(`SLA policy ${id} not found`);
  return policy;
};

export const createPolicy = async (input: CreateSlaPolicyInput) => {
  // Stage existence + escalation workflow existence (both nullable elements).
  await assertStageBelongsTo(input.parentStageId);
  await assertCalendarUsable(input.calendarId);
  await assertWorkflowUsable(input.escalationWorkflowId);

  // @@unique on parentStageId — one policy per stage. Surface a clean 409
  // before the DB raises one; revive soft-deleted on the same stage.
  const existing = await prisma.slaPolicy.findUnique({
    where: { parentStageId: input.parentStageId },
    select: { id: true, isDeleted: true },
  });
  if (existing && !existing.isDeleted) {
    throw Conflict(`Stage ${input.parentStageId} already has an SLA policy`);
  }
  if (existing?.isDeleted) {
    return prisma.slaPolicy.update({
      where: { id: existing.id },
      data: {
        duration: input.duration,
        calendarId: input.calendarId ?? null,
        escalationWorkflowId: input.escalationWorkflowId ?? null,
        pauseOnHold: input.pauseOnHold,
        pauseOnExtensionPending: input.pauseOnExtensionPending,
        isDeleted: false,
        responsibleRoles: { set: input.responsibleRoleIds.map((id) => ({ id })) },
        responsibleUsers: { set: input.responsibleUserIds.map((id) => ({ id })) },
      },
      select: policySelect,
    });
  }

  return prisma.slaPolicy.create({
    data: {
      parentStageId: input.parentStageId,
      duration: input.duration,
      calendarId: input.calendarId ?? null,
      escalationWorkflowId: input.escalationWorkflowId ?? null,
      pauseOnHold: input.pauseOnHold,
      pauseOnExtensionPending: input.pauseOnExtensionPending,
      responsibleRoles: input.responsibleRoleIds.length
        ? { connect: input.responsibleRoleIds.map((id) => ({ id })) }
        : undefined,
      responsibleUsers: input.responsibleUserIds.length
        ? { connect: input.responsibleUserIds.map((id) => ({ id })) }
        : undefined,
    },
    select: policySelect,
  });
};

export const updatePolicy = async (id: string, input: UpdateSlaPolicyInput) => {
  const existing = await prisma.slaPolicy.findUnique({
    where: { id },
    select: { id: true, isDeleted: true },
  });
  if (!existing) throw NotFound(`SLA policy ${id} not found`);
  if (existing.isDeleted) throw BadRequest('Cannot update a soft-deleted policy');

  if (input.calendarId !== undefined) await assertCalendarUsable(input.calendarId);
  if (input.escalationWorkflowId !== undefined) {
    await assertWorkflowUsable(input.escalationWorkflowId);
  }

  const data: Prisma.SlaPolicyUpdateInput = {};
  if (input.duration !== undefined) data.duration = input.duration;
  if (input.calendarId !== undefined) {
    data.calendar = input.calendarId
      ? { connect: { id: input.calendarId } }
      : { disconnect: true };
  }
  if (input.escalationWorkflowId !== undefined) {
    data.escalationWorkflow = input.escalationWorkflowId
      ? { connect: { id: input.escalationWorkflowId } }
      : { disconnect: true };
  }
  if (input.pauseOnHold !== undefined) data.pauseOnHold = input.pauseOnHold;
  if (input.pauseOnExtensionPending !== undefined) {
    data.pauseOnExtensionPending = input.pauseOnExtensionPending;
  }
  if (input.responsibleRoleIds !== undefined) {
    data.responsibleRoles = { set: input.responsibleRoleIds.map((id) => ({ id })) };
  }
  if (input.responsibleUserIds !== undefined) {
    data.responsibleUsers = { set: input.responsibleUserIds.map((id) => ({ id })) };
  }

  return prisma.slaPolicy.update({
    where: { id },
    data,
    select: policySelect,
  });
};

export const softDeletePolicy = async (id: string) => {
  const existing = await prisma.slaPolicy.findUnique({
    where: { id },
    select: { id: true, isDeleted: true },
  });
  if (!existing) throw NotFound(`SLA policy ${id} not found`);
  if (existing.isDeleted) return;

  await prisma.slaPolicy.update({
    where: { id },
    data: { isDeleted: true },
  });
};

// ─── Threshold upsert (replace-all-by-name) ────────────────────────────────

/**
 * Replaces the threshold set on a policy with the given list. Existing
 * thresholds whose `name` is NOT in the input are deleted (cascade deletes
 * their events through onDelete: SetNull on SlaTimerEvent.thresholdId).
 *
 * Idempotent — calling twice with the same input yields the same DB state.
 */
export const upsertThresholds = async (policyId: string, input: UpsertThresholdsInput) => {
  const policy = await prisma.slaPolicy.findUnique({
    where: { id: policyId },
    select: { id: true, isDeleted: true },
  });
  if (!policy) throw NotFound(`SLA policy ${policyId} not found`);
  if (policy.isDeleted) throw BadRequest('Cannot edit thresholds of a soft-deleted policy');

  // Validate target stages eagerly so the transaction doesn't half-apply.
  const targetIds = Array.from(
    new Set(
      input.thresholds.map((t) => t.targetSlaStageId).filter((x): x is string => Boolean(x)),
    ),
  );
  if (targetIds.length > 0) {
    const found = await prisma.workflowStage.findMany({
      where: { id: { in: targetIds }, isDeleted: false },
      select: { id: true },
    });
    if (found.length !== targetIds.length) {
      const foundSet = new Set(found.map((s) => s.id));
      const missing = targetIds.filter((id) => !foundSet.has(id));
      throw NotFound(`Target SLA stage(s) not found: ${missing.join(', ')}`);
    }
  }

  // Names in the input — duplicates would violate @@unique([policyId, name]).
  const wantedNames = input.thresholds.map((t) => t.name);
  if (new Set(wantedNames).size !== wantedNames.length) {
    throw BadRequest('Threshold names must be unique within a policy');
  }

  // Transaction does the WRITES only. The deep re-read happens after commit so
  // the tx doesn't time out on Neon — `policySelect` pulls ~10 related rows
  // and would burn the default 5s timeout when combined with per-threshold m2m
  // connects.
  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.slaThreshold.findMany({
        where: { policyId },
        select: { id: true, name: true },
      });
      const existingByName = new Map(existing.map((t) => [t.name, t.id]));

      const toDelete = existing
        .filter((t) => !wantedNames.includes(t.name))
        .map((t) => t.id);
      if (toDelete.length > 0) {
        await tx.slaThreshold.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (const t of input.thresholds) {
        const existingId = existingByName.get(t.name);
        if (existingId) {
          await tx.slaThreshold.update({
            where: { id: existingId },
            data: {
              percentage: t.percentage,
              targetSlaStageId: t.targetSlaStageId ?? null,
              notifyRoles: { set: t.notifyRoleIds.map((id) => ({ id })) },
              notifyUsers: { set: t.notifyUserIds.map((id) => ({ id })) },
            },
          });
        } else {
          await tx.slaThreshold.create({
            data: {
              policyId,
              name: t.name,
              percentage: t.percentage,
              targetSlaStageId: t.targetSlaStageId ?? null,
              notifyRoles: t.notifyRoleIds.length
                ? { connect: t.notifyRoleIds.map((id) => ({ id })) }
                : undefined,
              notifyUsers: t.notifyUserIds.length
                ? { connect: t.notifyUserIds.map((id) => ({ id })) }
                : undefined,
            },
          });
        }
      }
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  // Re-read after commit. Same pattern other modules use when the tx body has
  // to mutate m2m relations across many rows.
  return prisma.slaPolicy.findUnique({ where: { id: policyId }, select: policySelect });
};

export const deleteThreshold = async (thresholdId: string) => {
  const t = await prisma.slaThreshold.findUnique({
    where: { id: thresholdId },
    select: { id: true },
  });
  if (!t) throw NotFound(`SLA threshold ${thresholdId} not found`);

  await prisma.slaThreshold.delete({ where: { id: thresholdId } });
};

// ─── Timer read ────────────────────────────────────────────────────────────

export const listTimers = async (q: ListTimersQuery) => {
  const where: Prisma.SlaTimerWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.ticketId) where.ticketId = q.ticketId;
  if (q.workflowId) where.policy = { parentStage: { workflowId: q.workflowId } };

  const [items, total] = await Promise.all([
    prisma.slaTimer.findMany({
      where,
      orderBy: { deadline: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: timerSelect,
    }),
    prisma.slaTimer.count({ where }),
  ]);

  return { items, total, page: q.page, pageSize: q.pageSize };
};

export const getTicketSla = async (ticketId: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, isDeleted: true },
  });
  if (!ticket) throw NotFound(`Ticket ${ticketId} not found`);

  const timers = await prisma.slaTimer.findMany({
    where: { ticketId },
    orderBy: { startedAt: 'asc' },
    select: {
      ...timerSelect,
      events: {
        select: timerEventSelect,
        orderBy: { occurredAt: 'asc' },
      },
    },
  });
  return { timers };
};

// ─── Extension flow ────────────────────────────────────────────────────────

const TERMINAL_TIMER_STATUSES = ['COMPLETED', 'BREACHED'] as const;

export const requestExtension = async (
  timerId: string,
  input: RequestExtensionInput,
  requestedById: string,
) => {
  const timer = await prisma.slaTimer.findUnique({
    where: { id: timerId },
    select: { id: true, status: true },
  });
  if (!timer) throw NotFound(`SLA timer ${timerId} not found`);
  if ((TERMINAL_TIMER_STATUSES as readonly string[]).includes(timer.status)) {
    throw BadRequest(`Cannot extend a ${timer.status} timer`);
  }

  return prisma.slaExtension.create({
    data: {
      timerId,
      requestedById,
      extensionSec: input.extensionSec,
      reason: input.reason,
    },
    select: extensionSelect,
  });
};

/**
 * Approve or reject a pending extension request. On approval, atomically:
 *   - push the timer's deadline by `extensionSec`
 *   - increment totalExtensionsSec + extensionCount
 *   - flip status RUNNING → EXTENDED (preserve PAUSED if currently paused)
 *   - emit SlaTimerEvent(EXTENDED) with the new deadline + amount + approver
 */
export const decideExtension = async (
  extensionId: string,
  input: DecideExtensionInput,
  approverId: string,
) => {
  const existing = await prisma.slaExtension.findUnique({
    where: { id: extensionId },
    select: {
      id: true,
      status: true,
      extensionSec: true,
      timerId: true,
      requestedById: true,
    },
  });
  if (!existing) throw NotFound(`SLA extension ${extensionId} not found`);
  if (existing.status !== 'PENDING') {
    throw BadRequest(`Extension is already ${existing.status}`);
  }
  if (existing.requestedById === approverId) {
    throw BadRequest('Cannot approve your own extension request');
  }

  if (input.decision === 'REJECTED') {
    return prisma.slaExtension.update({
      where: { id: extensionId },
      data: {
        status: 'REJECTED',
        approverId,
        decidedAt: new Date(),
        // Capture optional approver reason inline so the audit trail is one row.
        ...(input.reason ? { reason: input.reason } : {}),
      },
      select: extensionSelect,
    });
  }

  // APPROVED path — needs to be transactional to keep timer + extension + event consistent.
  return prisma.$transaction(async (tx) => {
    const timer = await tx.slaTimer.findUnique({
      where: { id: existing.timerId },
      select: { id: true, status: true, deadline: true, totalExtensionsSec: true, extensionCount: true },
    });
    if (!timer) throw NotFound(`SLA timer ${existing.timerId} not found`);
    if ((TERMINAL_TIMER_STATUSES as readonly string[]).includes(timer.status)) {
      throw BadRequest(`Cannot extend a ${timer.status} timer`);
    }

    const newDeadline = new Date(timer.deadline.getTime() + existing.extensionSec * 1000);
    const newStatus = timer.status === 'PAUSED' ? 'PAUSED' : 'EXTENDED';

    await tx.slaTimer.update({
      where: { id: timer.id },
      data: {
        deadline: newDeadline,
        totalExtensionsSec: { increment: existing.extensionSec },
        extensionCount: { increment: 1 },
        status: newStatus,
      },
    });

    await tx.slaTimerEvent.create({
      data: {
        timerId: timer.id,
        eventType: 'EXTENDED',
        extensionAmountSec: existing.extensionSec,
        newDeadline,
        triggeredById: approverId,
        eventData: { extensionId: existing.id } as Prisma.InputJsonValue,
      },
    });

    return tx.slaExtension.update({
      where: { id: extensionId },
      data: {
        status: 'APPROVED',
        approverId,
        decidedAt: new Date(),
      },
      select: extensionSelect,
    });
  });
};
