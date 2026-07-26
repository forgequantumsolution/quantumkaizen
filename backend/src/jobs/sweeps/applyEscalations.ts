/**
 * SLA sweep — step 4: auto-reassignment (escalation matrix).
 *
 * Distinct from step 2 (which advances a spawned escalation CHILD ticket). This
 * step reassigns the PARENT ticket's `assigneeId` up the department's escalation
 * ladder when an SLA threshold is crossed or the SLA is breached.
 *
 * For each timer that has fired a THRESHOLD_HIT or BREACHED event, we look up
 * the ticket's department escalation rule (falling back to the global rule),
 * find the ladder levels whose trigger has fired, and for each un-applied level
 * resolve the next assignee (MANAGER / DEPARTMENT_HEAD, skipping unavailable
 * people) and reassign.
 *
 * Idempotency: latched against `EscalationEvent` rows keyed by
 * (ticketId, levelOrder, auto-reason) — a level reassigns at most once. Manual
 * reassignments (reason MANUAL) share the table but are excluded from the latch
 * so they never block an automatic escalation.
 *
 * Concurrency: the ticket row is locked with `SELECT ... FOR UPDATE` per level,
 * mirroring the other sweep steps, so two cron runs never double-apply.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { resolveNextAssignee, type TicketForEscalation } from '../../modules/escalation/resolveTarget';
import { getActiveRuleForDepartment } from '../../modules/escalation/escalation.service';
import { notify } from '../../modules/escalation/notify';

const AUTO_REASONS: Prisma.EscalationEventWhereInput['reason'] = {
  in: ['SLA_THRESHOLD', 'SLA_BREACH'],
};

export interface EscalationSweepResult {
  applied: number;
  errors: { ticketId: string; levelOrder: number; message: string }[];
}

export const applyEscalations = async (): Promise<EscalationSweepResult> => {
  const errors: EscalationSweepResult['errors'] = [];

  const timers = await prisma.slaTimer.findMany({
    where: { events: { some: { eventType: { in: ['THRESHOLD_HIT', 'BREACHED'] } } } },
    select: {
      id: true,
      events: {
        where: { eventType: { in: ['THRESHOLD_HIT', 'BREACHED'] } },
        select: { eventType: true, thresholdName: true },
      },
      ticket: {
        select: {
          id: true,
          uniqueId: true,
          title: true,
          isDeleted: true,
          departmentId: true,
          assigneeId: true,
          createdById: true,
          escalationLevel: true,
          flows: { select: { isCompleted: true } },
        },
      },
    },
  });

  let applied = 0;

  for (const timer of timers) {
    const ticket = timer.ticket;
    if (!ticket || ticket.isDeleted) continue;
    // Skip finished tickets — nothing to escalate once every flow is done.
    if (ticket.flows.length > 0 && ticket.flows.every((f) => f.isCompleted)) continue;

    const firedThresholds = new Set(
      timer.events
        .filter((e) => e.eventType === 'THRESHOLD_HIT')
        .map((e) => e.thresholdName)
        .filter((n): n is string => !!n),
    );
    const breached = timer.events.some((e) => e.eventType === 'BREACHED');
    if (firedThresholds.size === 0 && !breached) continue;

    const rule = await getActiveRuleForDepartment(ticket.departmentId);
    if (!rule || rule.levels.length === 0) continue;

    const toFire = rule.levels
      .filter((l) => (l.atThresholdName ? firedThresholds.has(l.atThresholdName) : breached))
      .sort((a, b) => a.order - b.order);
    if (toFire.length === 0) continue;

    // Carry the assignee forward across levels applied in the same pass, so a
    // MANAGER level after another resolves from the freshly-set assignee.
    let working: TicketForEscalation = {
      id: ticket.id,
      departmentId: ticket.departmentId,
      assigneeId: ticket.assigneeId,
      createdById: ticket.createdById,
    };

    for (const level of toFire) {
      const reason = level.atThresholdName ? 'SLA_THRESHOLD' : 'SLA_BREACH';
      try {
        const changedTo = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticket.id} FOR UPDATE`;

          const already = await tx.escalationEvent.findFirst({
            where: { ticketId: ticket.id, levelOrder: level.order, reason: AUTO_REASONS },
            select: { id: true },
          });
          if (already) return null;

          const resolved = await resolveNextAssignee(working, level.target, new Date(), tx);

          if (!resolved) {
            // No available target. Record a latched event so we don't re-scan
            // this level forever, and (on breach) flag it for admins. Leaves the
            // current assignee untouched — plan §9.2.
            await tx.escalationEvent.create({
              data: {
                ticketId: ticket.id,
                fromUserId: working.assigneeId,
                toUserId: null,
                reason,
                levelOrder: level.order,
                detail: `No available ${level.target} to escalate to`,
              },
            });
            return null;
          }

          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              assignee: { connect: { id: resolved.toUserId } },
              escalationLevel: level.order,
            },
          });
          await tx.escalationEvent.create({
            data: {
              ticketId: ticket.id,
              fromUserId: working.assigneeId,
              toUserId: resolved.toUserId,
              reason,
              levelOrder: level.order,
              detail: level.atThresholdName
                ? `SLA threshold "${level.atThresholdName}" crossed`
                : 'SLA breached',
            },
          });
          await notify(
            {
              userId: resolved.toUserId,
              type: 'ESCALATED',
              title: `Escalated to you: ${ticket.uniqueId}`,
              body: ticket.title,
              entityType: 'ticket',
              entityId: ticket.id,
            },
            tx,
          );
          return resolved.toUserId;
        });

        if (changedTo) {
          working = { ...working, assigneeId: changedTo };
          applied += 1;
        }
      } catch (err) {
        errors.push({
          ticketId: ticket.id,
          levelOrder: level.order,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { applied, errors };
};
