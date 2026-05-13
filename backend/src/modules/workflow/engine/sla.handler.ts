/**
 * SLA lifecycle hooks called from the engine.
 *
 *   - `onStageEntered`  — create SlaTimer + (optionally) spawn escalation child ticket
 *   - `onStageExited`   — settle the timer (COMPLETED / COMPLETED_LATE / BREACHED) + emit event
 *   - `onTicketHeld`    — pause active timers where policy.pauseOnHold
 *   - `onTicketResumed` — resume paused timers
 *
 * All hooks take a Prisma `tx` and ride on the caller's transaction. They no-op
 * silently when the stage has no SlaPolicy — the engine doesn't need to check.
 *
 * The escalation child ticket is the Django pattern from Q13 (signed off
 * 2026-05-12): when a parent enters an SLA-tracked stage AND
 * `SlaPolicy.escalationWorkflowId` is set, we raise a child Ticket on that
 * workflow. The threshold cron sweep (P3.6) advances only that child — the
 * parent ticket is never auto-moved by SLA.
 */
import { Prisma } from '@prisma/client';
import { addBusinessSeconds, type BusinessCalendarRef, type WeeklySchedule } from './calendar';
import { emitAuditEvent } from './audit.emitter';
import type { ActorContext } from './types';

type Tx = Prisma.TransactionClient;

interface StageRef {
  id: string;
  name: string;
  workflowId: string;
}

const policyWithCalendarSelect = {
  id: true,
  duration: true,
  pauseOnHold: true,
  escalationWorkflowId: true,
  calendar: {
    select: { timezone: true, weeklySchedule: true, holidays: true, isActive: true },
  },
} satisfies Prisma.SlaPolicySelect;

const toCalendarRef = (
  cal: { timezone: string; weeklySchedule: Prisma.JsonValue; holidays: Prisma.JsonValue; isActive: boolean } | null,
): BusinessCalendarRef | null => {
  if (!cal || !cal.isActive) return null;
  return {
    timezone: cal.timezone,
    weeklySchedule: (cal.weeklySchedule ?? {}) as WeeklySchedule,
    holidays: Array.isArray(cal.holidays) ? (cal.holidays as string[]) : [],
  };
};

// ─── onStageEntered ────────────────────────────────────────────────────────

/**
 * Called from `tracking.layer.openStageTracking` after the tracking row is
 * created. If the stage has an SLA policy, creates a timer (and optionally
 * spawns an escalation child ticket).
 */
export const onStageEntered = async (
  tx: Tx,
  ticketId: string,
  stage: StageRef,
  actor: ActorContext | null = null,
): Promise<void> => {
  const policy = await tx.slaPolicy.findUnique({
    where: { parentStageId: stage.id },
    select: policyWithCalendarSelect,
  });
  if (!policy) return;

  const now = new Date();
  const calendar = toCalendarRef(policy.calendar);
  const deadline = addBusinessSeconds(now, policy.duration, calendar);

  // Spawn escalation child ticket if the policy points at an escalation workflow.
  // We can't recurse into `orchestrator.raiseTicket` from inside a transaction
  // (would re-enter raise's own tx); instead, mint a child Ticket + TicketFlow
  // inline, parented to the current ticket + stage. The escalation workflow
  // engine logic (advance through stages) runs via the cron sweep in P3.6.
  let escalationTicketId: string | null = null;
  if (policy.escalationWorkflowId) {
    const escWorkflow = await tx.workflow.findUnique({
      where: { id: policy.escalationWorkflowId },
      select: {
        id: true,
        name: true,
        version: true,
        isDeleted: true,
        workflowStatus: true,
        type: { select: { codePrefix: true } },
      },
    });
    if (escWorkflow && !escWorkflow.isDeleted && escWorkflow.workflowStatus === 'ACTIVE') {
      const initial = await tx.workflowStage.findFirst({
        where: { workflowId: escWorkflow.id, isInitialStage: true, isDeleted: false },
        select: { id: true, name: true },
      });
      if (initial) {
        const parent = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: { uniqueId: true, title: true },
        });
        // Use the parent's uniqueId as a deterministic child suffix so we can
        // see the lineage at a glance. Format: `{parentId}-SLA`.
        const escUniqueId = `${parent?.uniqueId ?? 'UNKNOWN'}-SLA`;
        const escTicket = await tx.ticket.create({
          data: {
            uniqueId: escUniqueId,
            title: `SLA escalation for ${parent?.title ?? ticketId}`,
            parentTicketId: ticketId,
            parentTicketStageId: stage.id,
            createdById: actor?.id ?? null,
          },
          select: { id: true },
        });
        await tx.ticketFlow.create({
          data: {
            ticketId: escTicket.id,
            workflowId: escWorkflow.id,
            workflowName: escWorkflow.name,
            workflowVersion: escWorkflow.version,
            currentStages: { connect: [{ id: initial.id }] },
          },
        });
        await tx.ticketStageTracking.create({
          data: {
            ticketId: escTicket.id,
            stageId: initial.id,
            stageName: initial.name,
            stageWorkflowId: escWorkflow.id,
            isActive: true,
          },
        });
        escalationTicketId = escTicket.id;
      }
    }
  }

  const timer = await tx.slaTimer.create({
    data: {
      ticketId,
      stageId: stage.id,
      policyId: policy.id,
      escalationTicketId,
      status: 'RUNNING',
      startedAt: now,
      deadline,
      lastResumedAt: now,
    },
    select: { id: true },
  });

  await tx.slaTimerEvent.create({
    data: {
      timerId: timer.id,
      eventType: 'STARTED',
      eventData: {
        deadlineComputedFrom: now.toISOString(),
        durationSec: policy.duration,
        escalationTicketId,
      } as Prisma.InputJsonValue,
      triggeredById: actor?.id ?? null,
    },
  });

  await emitAuditEvent(
    tx,
    { ticketId, workflowId: stage.workflowId },
    'SLA_TIMER_STARTED',
    {
      timerId: timer.id,
      stageId: stage.id,
      policyId: policy.id,
      deadline: deadline.toISOString(),
      escalationTicketId,
    },
    actor,
  );
};

// ─── onStageExited ─────────────────────────────────────────────────────────

/**
 * Called from `tracking.layer.closeStageTracking`. Marks the timer as
 * COMPLETED, COMPLETED_LATE, or BREACHED depending on whether the deadline
 * had already passed by exit time.
 */
export const onStageExited = async (
  tx: Tx,
  ticketId: string,
  stageId: string,
  actor: ActorContext | null = null,
): Promise<void> => {
  const timers = await tx.slaTimer.findMany({
    where: {
      ticketId,
      stageId,
      status: { in: ['RUNNING', 'PAUSED', 'EXTENDED'] },
    },
    select: { id: true, status: true, deadline: true },
  });
  if (timers.length === 0) return;

  const now = new Date();
  for (const t of timers) {
    const exitedAfterDeadline = now.getTime() > t.deadline.getTime();
    // The timer's status before exit decides the final state:
    //   - already past deadline → BREACHED was set by the cron; exiting now is COMPLETED_LATE
    //   - still within deadline at exit → COMPLETED
    //   - currently PAUSED but exit window past deadline → still COMPLETED_LATE (parent is moving on)
    const finalStatus = exitedAfterDeadline ? 'BREACHED' : 'COMPLETED';
    const eventType: 'COMPLETED' | 'COMPLETED_LATE' = exitedAfterDeadline
      ? 'COMPLETED_LATE'
      : 'COMPLETED';

    await tx.slaTimer.update({
      where: { id: t.id },
      data: { status: finalStatus, completedAt: now },
    });
    await tx.slaTimerEvent.create({
      data: {
        timerId: t.id,
        eventType,
        triggeredById: actor?.id ?? null,
      },
    });
  }

  await emitAuditEvent(
    tx,
    { ticketId },
    'SLA_TIMER_COMPLETED',
    { stageId, timerIds: timers.map((t) => t.id) },
    actor,
  );
};

// ─── onTicketHeld / onTicketResumed ────────────────────────────────────────

/**
 * Pause active timers whose policy has `pauseOnHold = true`. Accumulates
 * elapsedBeforePauseSec from `lastResumedAt` to now, then clears
 * `lastResumedAt` and flips status to PAUSED.
 */
export const onTicketHeld = async (
  tx: Tx,
  ticketId: string,
  actor: ActorContext | null = null,
): Promise<void> => {
  const candidates = await tx.slaTimer.findMany({
    where: {
      ticketId,
      status: { in: ['RUNNING', 'EXTENDED'] },
    },
    select: {
      id: true,
      lastResumedAt: true,
      elapsedBeforePauseSec: true,
      policy: { select: { pauseOnHold: true } },
    },
  });

  const now = new Date();
  for (const t of candidates) {
    if (!t.policy.pauseOnHold) continue;
    const currentRunSec = t.lastResumedAt
      ? Math.max(0, Math.floor((now.getTime() - t.lastResumedAt.getTime()) / 1000))
      : 0;
    await tx.slaTimer.update({
      where: { id: t.id },
      data: {
        status: 'PAUSED',
        elapsedBeforePauseSec: t.elapsedBeforePauseSec + currentRunSec,
        lastResumedAt: null,
      },
    });
    await tx.slaTimerEvent.create({
      data: {
        timerId: t.id,
        eventType: 'PAUSED',
        triggeredById: actor?.id ?? null,
      },
    });
  }
};

/**
 * Resume paused timers. Sets `lastResumedAt = now` and flips status back to
 * RUNNING (or EXTENDED if `extensionCount > 0`). Deadline is NOT touched —
 * the elapsed-time accounting via `elapsedBeforePauseSec + lastResumedAt`
 * already excludes paused periods.
 */
export const onTicketResumed = async (
  tx: Tx,
  ticketId: string,
  actor: ActorContext | null = null,
): Promise<void> => {
  const paused = await tx.slaTimer.findMany({
    where: { ticketId, status: 'PAUSED' },
    select: { id: true, extensionCount: true },
  });
  const now = new Date();
  for (const t of paused) {
    await tx.slaTimer.update({
      where: { id: t.id },
      data: {
        status: t.extensionCount > 0 ? 'EXTENDED' : 'RUNNING',
        lastResumedAt: now,
      },
    });
    await tx.slaTimerEvent.create({
      data: {
        timerId: t.id,
        eventType: 'RESUMED',
        triggeredById: actor?.id ?? null,
      },
    });
  }
};
