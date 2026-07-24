import { prismaBase } from './prisma';
import { computeHash } from './audit-hash';

/**
 * Seals the hash chain over audit entries written since the last run.
 *
 * Entries are inserted unsealed (`hash`/`prevHash` NULL) so that no request has
 * to take a global lock — see the note on `recordAudit`. This walks the unsealed
 * tail in `seq` order, links each entry to the one before it, and stamps the
 * pair of hash columns.
 *
 * What this does and does not protect. Mutation and deletion of audit rows are
 * blocked at all times by the append-only triggers, sealed or not. The chain is
 * the *second* line of defence: it detects tampering that bypasses those
 * triggers entirely (a superuser disabling them, or the data files being edited
 * underneath the database). Entries in the unsealed tail are covered by the
 * triggers but not yet by the chain, so the sealer should run often — it is
 * cheap, and the window is what an inspector will ask about.
 *
 * Runs single-threaded under a session-scoped advisory lock: two sealers racing
 * would fork the chain. The lock is taken and released by this function alone
 * and never spans a caller's transaction, which is what made the original
 * design deadlock.
 */

const SEAL_LOCK_KEY = 8_143_552_901; // arbitrary, fixed: identifies the sealer

export interface SealResult {
  sealed: number;
  chains: string[];
  skipped: boolean;
}

export const sealPendingEntries = async (batchSize = 5_000): Promise<SealResult> => {
  // Non-blocking: if another sealer holds the lock there is nothing useful to
  // wait for, since it is draining the same queue.
  const [{ locked }] = await prismaBase.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(${SEAL_LOCK_KEY}) AS locked
  `;
  if (!locked) return { sealed: 0, chains: [], skipped: true };

  try {
    const pending = await prismaBase.auditTrailEntry.findMany({
      where: { hash: null },
      orderBy: { seq: 'asc' },
      take: batchSize,
    });
    if (!pending.length) return { sealed: 0, chains: [], skipped: false };

    // Chains are per UTC day; resume each from its last sealed entry.
    const heads = new Map<string, string | null>();
    const chains = new Set<string>();
    let sealed = 0;

    for (const e of pending) {
      const chainKey = e.chainKey ?? e.createdAt.toISOString().slice(0, 10);
      chains.add(chainKey);

      if (!heads.has(chainKey)) {
        const prior = await prismaBase.auditTrailEntry.findFirst({
          where: { chainKey, hash: { not: null } },
          orderBy: { seq: 'desc' },
          select: { hash: true },
        });
        heads.set(chainKey, prior?.hash ?? null);
      }

      const prevHash = heads.get(chainKey) ?? null;
      const hash = computeHash(
        {
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.action,
          field: e.field,
          oldValue: e.oldValue,
          newValue: e.newValue,
          diff: e.diff ?? null,
          reason: e.reason,
          reasonCode: e.reasonCode,
          userId: e.userId,
          userName: e.userName,
          actorType: e.actorType,
          sessionId: e.sessionId,
          ipAddress: e.ipAddress,
          createdAt: e.createdAt,
        },
        prevHash,
      );

      // Permitted by the append-only trigger only as a one-way seal: NULL hash
      // becoming non-NULL, with every other column untouched.
      await prismaBase.$executeRaw`
        UPDATE "AuditTrailEntry"
        SET "prevHash" = ${prevHash}, "hash" = ${hash}, "chainKey" = ${chainKey}
        WHERE id = ${e.id} AND "hash" IS NULL
      `;
      heads.set(chainKey, hash);
      sealed += 1;
    }

    return { sealed, chains: [...chains], skipped: false };
  } finally {
    await prismaBase.$queryRaw`SELECT pg_advisory_unlock(${SEAL_LOCK_KEY})`;
  }
};

/**
 * Re-walks sealed entries and reports the first break. This is the evidence an
 * inspector asks for: proof the trail has not been altered since it was written.
 */
export const verifyChain = async (chainKey?: string) => {
  const entries = await prismaBase.auditTrailEntry.findMany({
    where: { hash: { not: null }, ...(chainKey ? { chainKey } : {}) },
    orderBy: [{ chainKey: 'asc' }, { seq: 'asc' }],
  });

  const heads = new Map<string, string | null>();
  const breaks: Array<{ seq: string; chainKey: string; reason: string }> = [];

  for (const e of entries) {
    const key = e.chainKey ?? 'unknown';
    const expectedPrev = heads.get(key) ?? null;
    if (heads.has(key) && e.prevHash !== expectedPrev) {
      breaks.push({ seq: String(e.seq), chainKey: key, reason: 'prevHash does not match the preceding entry' });
    }
    const recomputed = computeHash(
      {
        entityType: e.entityType,
        entityId: e.entityId,
        action: e.action,
        field: e.field,
        oldValue: e.oldValue,
        newValue: e.newValue,
        diff: e.diff ?? null,
        reason: e.reason,
        reasonCode: e.reasonCode,
        userId: e.userId,
        userName: e.userName,
        actorType: e.actorType,
        sessionId: e.sessionId,
        ipAddress: e.ipAddress,
        createdAt: e.createdAt,
      },
      e.prevHash,
    );
    if (recomputed !== e.hash) {
      breaks.push({ seq: String(e.seq), chainKey: key, reason: 'content does not match its recorded hash' });
    }
    heads.set(key, e.hash);
  }

  const unsealed = await prismaBase.auditTrailEntry.count({ where: { hash: null } });
  return { checked: entries.length, unsealed, breaks, intact: breaks.length === 0 };
};
