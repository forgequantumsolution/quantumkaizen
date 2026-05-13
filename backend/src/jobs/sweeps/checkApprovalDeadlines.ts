/**
 * Approval-deadline expiration sweep. Runs every 30 min in production
 * (independent of `checkSlaTimers` since it targets approvals, not timers).
 *
 * Finds `ApprovalInstance` rows where `status = PENDING AND deadlineAt <= now()`
 * and flips them to `EXPIRED`. Ticket stays in stage (same semantic as Q5 —
 * the ticket isn't affected by an approval expiring; admins can re-trigger or
 * the user can re-invoke the action).
 */
import { prisma } from '../../lib/prisma';

export interface ApprovalDeadlineResult {
  inspected: number;
  expired: number;
  errors: { instanceId: string; message: string }[];
}

const log = (msg: string, extra?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.info(`[approval-deadlines] ${msg}`, extra ? JSON.stringify(extra) : '');
};

export const checkApprovalDeadlines = async (): Promise<ApprovalDeadlineResult> => {
  const errors: ApprovalDeadlineResult['errors'] = [];
  const now = new Date();

  const candidates = await prisma.approvalInstance.findMany({
    where: {
      status: 'PENDING',
      deadlineAt: { lte: now },
    },
    select: { id: true, ticketId: true, policyId: true },
  });

  let expired = 0;
  for (const c of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ApprovalInstance" WHERE id = ${c.id}::uuid FOR UPDATE`;
        const inst = await tx.approvalInstance.findUnique({
          where: { id: c.id },
          select: { id: true, status: true, deadlineAt: true },
        });
        if (!inst || inst.status !== 'PENDING') return;
        if (!inst.deadlineAt || inst.deadlineAt.getTime() > Date.now()) return;

        await tx.approvalInstance.update({
          where: { id: c.id },
          data: { status: 'EXPIRED', completedAt: new Date() },
        });
        expired += 1;
      });
    } catch (err) {
      errors.push({
        instanceId: c.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const result = { inspected: candidates.length, expired, errors };
  log('checkApprovalDeadlines complete', result);
  return result;
};
