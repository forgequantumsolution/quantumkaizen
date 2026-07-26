/**
 * Escalation-target resolver — shared by the SLA sweep (auto-escalation on
 * threshold/breach) and the assignment flow (skip an unavailable assignee).
 *
 * The ladder is fixed two steps — MANAGER then DEPARTMENT_HEAD (see the
 * escalation-matrix plan). This module answers two questions:
 *   1. isAvailable(userId)                — is this person able to take work now?
 *   2. resolveNextAssignee(ticket, target) — who should the ticket go to for
 *                                            the given ladder target, skipping
 *                                            anyone unavailable via their
 *                                            delegate → manager fallthrough?
 *
 * All reads accept a `db` handle so callers can run inside their own
 * transaction (the sweep locks the timer row, then resolves against the same
 * tx). Defaults to the shared prisma client for standalone use.
 */
import type { EscalationTarget } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// Anything with the model accessors we touch — satisfied by both the base
// client and a Prisma.TransactionClient.
type Db = Pick<typeof prisma, 'user' | 'department' | 'userAvailability'>;

// Walking the delegate/manager chain is bounded so a mis-configured cycle
// (A delegates to B, B delegates to A) can never loop forever.
const MAX_CHAIN_DEPTH = 10;

export interface TicketForEscalation {
  id: string;
  departmentId: string | null;
  assigneeId: string | null;
  createdById: string | null;
}

export interface ResolvedTarget {
  toUserId: string;
}

/**
 * A user is unavailable when they are inactive OR an out-of-office window
 * covers `at`. Returns the covering window (with its delegate) when one exists,
 * so callers can prefer the named backup before walking the manager chain.
 */
const activeWindow = async (db: Db, userId: string, at: Date) =>
  db.userAvailability.findFirst({
    where: { userId, from: { lte: at }, to: { gt: at } },
    orderBy: { from: 'desc' },
    select: { id: true, delegateToId: true },
  });

export const isAvailable = async (
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<boolean> => {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isActive: true } });
  if (!user || !user.isActive) return false;
  const window = await activeWindow(db, userId, at);
  return window === null;
};

/**
 * Starting from `userId`, return the first available person, preferring the
 * out-of-office delegate, then walking up the manager chain. Returns null if
 * nobody in the chain is available (caller decides the fallback — e.g. notify
 * admins on breach).
 */
const firstAvailableFrom = async (
  db: Db,
  userId: string | null,
  at: Date,
  seen: Set<string> = new Set(),
): Promise<string | null> => {
  let current = userId;
  let depth = 0;
  while (current && !seen.has(current) && depth < MAX_CHAIN_DEPTH) {
    seen.add(current);
    depth += 1;
    const user = await db.user.findUnique({
      where: { id: current },
      select: { isActive: true, managerId: true },
    });
    if (!user) return null;
    if (user.isActive) {
      const window = await activeWindow(db, current, at);
      if (!window) return current;
      // Out of office — try the named delegate before climbing the chain.
      if (window.delegateToId && !seen.has(window.delegateToId)) {
        const viaDelegate = await firstAvailableFrom(db, window.delegateToId, at, seen);
        if (viaDelegate) return viaDelegate;
      }
    }
    current = user.managerId;
  }
  return null;
};

/**
 * Who covers for a user who is now unavailable: their out-of-office delegate
 * first, then up their manager chain, skipping anyone else also unavailable.
 * Used to move an out-of-office assignee's open tickets. Returns null if nobody
 * in the chain is available (leave the ticket where it is). `firstAvailableFrom`
 * starting at `userId` naturally consults that user's active OOO window
 * (delegate) before climbing, and never returns `userId` itself while they are
 * unavailable — but we guard against it defensively.
 */
export const resolveCoverFor = async (
  userId: string,
  at: Date = new Date(),
  db: Db = prisma,
): Promise<string | null> => {
  const to = await firstAvailableFrom(db, userId, at, new Set());
  return to && to !== userId ? to : null;
};

/**
 * Resolve the concrete assignee for a ladder target on a ticket, skipping
 * anyone unavailable. `MANAGER` climbs from the ticket's current assignee
 * (falling back to its creator when unassigned); `DEPARTMENT_HEAD` uses the
 * ticket department's head. Returns null when the target can't be resolved
 * (no manager / no department head / nobody available in the chain) or when it
 * would resolve back to the current assignee (nothing to escalate).
 */
export const resolveNextAssignee = async (
  ticket: TicketForEscalation,
  target: EscalationTarget,
  at: Date = new Date(),
  db: Db = prisma,
): Promise<ResolvedTarget | null> => {
  let seedUserId: string | null = null;

  if (target === 'MANAGER') {
    const base = ticket.assigneeId ?? ticket.createdById;
    if (!base) return null;
    const u = await db.user.findUnique({ where: { id: base }, select: { managerId: true } });
    seedUserId = u?.managerId ?? null;
  } else if (target === 'DEPARTMENT_HEAD') {
    if (!ticket.departmentId) return null;
    const d = await db.department.findUnique({
      where: { id: ticket.departmentId },
      select: { headUserId: true },
    });
    seedUserId = d?.headUserId ?? null;
  }

  if (!seedUserId) return null;

  // Don't let the chain resolve back onto the person we're escalating away from.
  const seen = new Set<string>();
  if (ticket.assigneeId) seen.add(ticket.assigneeId);

  const toUserId = await firstAvailableFrom(db, seedUserId, at, seen);
  if (!toUserId || toUserId === ticket.assigneeId) return null;
  return { toUserId };
};
