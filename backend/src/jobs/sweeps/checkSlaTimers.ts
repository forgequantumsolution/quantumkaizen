/**
 * The single combined SLA sweep (Q11 — signed off 2026-05-12).
 *
 * In sequence on every cron tick:
 *   1) checkThresholds       — find timers crossing thresholds; emit THRESHOLD_HIT events
 *   2) triggerSlaTransitions — for each THRESHOLD_HIT lacking a SLA_TRANSITION:
 *                              advance the escalation child ticket
 *                              (the parent ticket is NEVER moved here — Q13)
 *   3) checkBreaches         — find timers past deadline; flip to BREACHED + emit
 *
 * Idempotency: each step latches against existing `SlaTimerEvent` rows
 *   - `THRESHOLD_HIT` rows are unique per (timer, thresholdName) → step 1 won't double-fire
 *   - `SLA_TRANSITION` rows are unique per (timer, thresholdName) → step 2 catches up missed runs
 *   - Step 3 only flips timers still in RUNNING/EXTENDED → no double-flip
 *
 * Concurrency: each timer is locked via `SELECT FOR UPDATE` inside its own
 * mini-transaction so two cron runs never race on the same timer.
 *
 * Errors are caught per-timer — one bad row never aborts the sweep.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { computeElapsedSec, computePercentageConsumed } from './computeElapsed';

export interface SweepResult {
  timersInspected: number;
  thresholdsFired: number;
  transitionsTriggered: number;
  breachesFound: number;
  errors: { timerId: string; phase: 'threshold' | 'transition' | 'breach'; message: string }[];
}

const log = (msg: string, extra?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.info(`[sla-sweep] ${msg}`, extra ? JSON.stringify(extra) : '');
};

// ─── Step 1: thresholds ────────────────────────────────────────────────────

/**
 * Find timers in RUNNING/EXTENDED whose elapsed-percentage now crosses one or
 * more threshold percentages that haven't been fired yet. Emits THRESHOLD_HIT
 * events. Returns the number of new events written.
 */
export const checkThresholds = async (): Promise<{ inspected: number; fired: number; errors: SweepResult['errors'] }> => {
  const errors: SweepResult['errors'] = [];
  const candidates = await prisma.slaTimer.findMany({
    where: { status: { in: ['RUNNING', 'EXTENDED'] } },
    select: {
      id: true,
      policyId: true,
      policy: {
        select: {
          duration: true,
          thresholds: {
            select: { id: true, name: true, percentage: true },
            orderBy: { percentage: 'asc' },
          },
        },
      },
    },
  });

  let fired = 0;
  for (const cand of candidates) {
    if (cand.policy.thresholds.length === 0) continue;
    try {
      const writes = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "SlaTimer" WHERE id = ${cand.id} FOR UPDATE`;
          // Re-read locked timer to pick up any concurrent updates (extensions, holds).
          const timer = await tx.slaTimer.findUnique({
            where: { id: cand.id },
            select: {
              id: true,
              status: true,
              elapsedBeforePauseSec: true,
              lastResumedAt: true,
              totalExtensionsSec: true,
            },
          });
          if (!timer || (timer.status !== 'RUNNING' && timer.status !== 'EXTENDED')) {
            return 0;
          }

          const fired = await tx.slaTimerEvent.findMany({
            where: { timerId: cand.id, eventType: 'THRESHOLD_HIT' },
            select: { thresholdName: true },
          });
          const firedSet = new Set(fired.map((e) => e.thresholdName).filter(Boolean) as string[]);

          const elapsedPct = computePercentageConsumed(timer, { duration: cand.policy.duration });
          let count = 0;
          for (const th of cand.policy.thresholds) {
            if (firedSet.has(th.name)) continue;
            if (elapsedPct < th.percentage) continue;
            await tx.slaTimerEvent.create({
              data: {
                timerId: cand.id,
                eventType: 'THRESHOLD_HIT',
                thresholdId: th.id,
                thresholdName: th.name,
                thresholdPercentage: elapsedPct,
                eventData: { configuredPercentage: th.percentage } as Prisma.InputJsonValue,
              },
            });
            count += 1;
          }
          return count;
        },
        { timeout: 15_000 },
      );
      fired += writes;
    } catch (err) {
      errors.push({
        timerId: cand.id,
        phase: 'threshold',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { inspected: candidates.length, fired, errors };
};

// ─── Step 2: trigger SLA workflow transitions ──────────────────────────────

/**
 * Find THRESHOLD_HIT events without a matching SLA_TRANSITION event AND whose
 * threshold has a `targetSlaStageId`. For each, advance the escalation child
 * ticket (NOT the parent — Q13) via direct `TicketFlow.currentStages` mutation.
 *
 * Uses `transition.layer.advanceFlow` directly to avoid recursing through
 * orchestrator.performAction (which would re-trigger access/approval/SLA hooks
 * on the escalation workflow's own stages).
 */
export const triggerSlaTransitions = async (): Promise<{ triggered: number; errors: SweepResult['errors'] }> => {
  const errors: SweepResult['errors'] = [];

  // Find timers with at least one un-transitioned THRESHOLD_HIT + an escalation ticket
  // attached + at least one threshold with a target stage.
  const candidates = await prisma.slaTimer.findMany({
    where: {
      escalationTicketId: { not: null },
      events: {
        some: {
          eventType: 'THRESHOLD_HIT',
          thresholdId: { not: null },
        },
      },
    },
    select: {
      id: true,
      escalationTicketId: true,
      policyId: true,
      events: {
        where: { eventType: { in: ['THRESHOLD_HIT', 'SLA_TRANSITION'] } },
        select: { eventType: true, thresholdName: true, thresholdId: true },
      },
    },
  });

  let triggered = 0;
  for (const cand of candidates) {
    if (!cand.escalationTicketId) continue;
    const hits = cand.events.filter((e) => e.eventType === 'THRESHOLD_HIT');
    const transitioned = new Set(
      cand.events
        .filter((e) => e.eventType === 'SLA_TRANSITION')
        .map((e) => e.thresholdName)
        .filter(Boolean) as string[],
    );

    // Resolve thresholds for the un-transitioned hits, ordered by percentage so
    // we apply them in escalation order if multiple fired in the same sweep.
    const pendingThresholdIds = hits
      .filter((h) => h.thresholdName && !transitioned.has(h.thresholdName))
      .map((h) => h.thresholdId!)
      .filter(Boolean);
    if (pendingThresholdIds.length === 0) continue;

    const thresholds = await prisma.slaThreshold.findMany({
      where: { id: { in: pendingThresholdIds }, targetSlaStageId: { not: null } },
      select: { id: true, name: true, percentage: true, targetSlaStageId: true },
      orderBy: { percentage: 'asc' },
    });

    for (const th of thresholds) {
      if (!th.targetSlaStageId) continue;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "SlaTimer" WHERE id = ${cand.id} FOR UPDATE`;
          // Re-check the latch inside the tx.
          const alreadyTransitioned = await tx.slaTimerEvent.findFirst({
            where: { timerId: cand.id, eventType: 'SLA_TRANSITION', thresholdName: th.name },
            select: { id: true },
          });
          if (alreadyTransitioned) return;

          // Advance the escalation ticket's flow: exit current stages, enter target.
          const flow = await tx.ticketFlow.findFirst({
            where: { ticketId: cand.escalationTicketId! },
            select: {
              id: true,
              currentStages: { select: { id: true, name: true } },
            },
          });
          if (!flow) {
            throw new Error(`Escalation ticket ${cand.escalationTicketId} has no TicketFlow`);
          }

          // Close active tracking rows on the current escalation stages.
          for (const cur of flow.currentStages) {
            await tx.ticketStageTracking.updateMany({
              where: { ticketId: cand.escalationTicketId!, stageId: cur.id, isActive: true },
              data: {
                exitedAt: new Date(),
                isActive: false,
                remarks: `SLA threshold "${th.name}" auto-transition`,
              },
            });
          }
          // Mutate currentStages: disconnect all, connect target.
          await tx.ticketFlow.update({
            where: { id: flow.id },
            data: {
              currentStages: {
                disconnect: flow.currentStages.map((s) => ({ id: s.id })),
                connect: [{ id: th.targetSlaStageId! }],
              },
            },
          });
          const target = await tx.workflowStage.findUnique({
            where: { id: th.targetSlaStageId! },
            select: { id: true, name: true, workflowId: true },
          });
          if (target) {
            await tx.ticketStageTracking.create({
              data: {
                ticketId: cand.escalationTicketId!,
                stageId: target.id,
                stageName: target.name,
                stageWorkflowId: target.workflowId,
                isActive: true,
              },
            });
          }

          await tx.slaTimerEvent.create({
            data: {
              timerId: cand.id,
              eventType: 'SLA_TRANSITION',
              thresholdId: th.id,
              thresholdName: th.name,
              eventData: {
                escalationTicketId: cand.escalationTicketId,
                advancedToStageId: th.targetSlaStageId,
              } as Prisma.InputJsonValue,
            },
          });
          triggered += 1;
        });
      } catch (err) {
        errors.push({
          timerId: cand.id,
          phase: 'transition',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return { triggered, errors };
};

// ─── Step 3: breaches ──────────────────────────────────────────────────────

export const checkBreaches = async (): Promise<{ found: number; errors: SweepResult['errors'] }> => {
  const errors: SweepResult['errors'] = [];
  const now = new Date();
  const candidates = await prisma.slaTimer.findMany({
    where: {
      status: { in: ['RUNNING', 'EXTENDED'] },
      deadline: { lte: now },
    },
    select: { id: true },
  });

  let found = 0;
  for (const c of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "SlaTimer" WHERE id = ${c.id} FOR UPDATE`;
        const t = await tx.slaTimer.findUnique({
          where: { id: c.id },
          select: {
            id: true,
            status: true,
            deadline: true,
            elapsedBeforePauseSec: true,
            lastResumedAt: true,
            totalExtensionsSec: true,
          },
        });
        if (!t || (t.status !== 'RUNNING' && t.status !== 'EXTENDED')) return;
        if (t.deadline.getTime() > Date.now()) return; // someone extended after our outer SELECT

        const elapsedSec = computeElapsedSec(t);
        await tx.slaTimer.update({
          where: { id: t.id },
          data: { status: 'BREACHED', elapsedBeforePauseSec: elapsedSec },
        });
        await tx.slaTimerEvent.create({
          data: {
            timerId: t.id,
            eventType: 'BREACHED',
            eventData: { breachedAt: new Date().toISOString() } as Prisma.InputJsonValue,
          },
        });
        found += 1;
      });
    } catch (err) {
      errors.push({
        timerId: c.id,
        phase: 'breach',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { found, errors };
};

// ─── Combined sweep ────────────────────────────────────────────────────────

export const checkSlaTimers = async (): Promise<SweepResult> => {
  const start = Date.now();
  const t = await checkThresholds();
  const tr = await triggerSlaTransitions();
  const b = await checkBreaches();
  const result: SweepResult = {
    timersInspected: t.inspected,
    thresholdsFired: t.fired,
    transitionsTriggered: tr.triggered,
    breachesFound: b.found,
    errors: [...t.errors, ...tr.errors, ...b.errors],
  };
  log('checkSlaTimers complete', { ...result, ms: Date.now() - start });
  return result;
};
