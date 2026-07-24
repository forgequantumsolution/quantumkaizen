import { createHash, randomUUID } from 'node:crypto';

/**
 * Tamper evidence for the audit trail (ALCOA++ "Original"/"Enduring",
 * 21 CFR Part 11 §11.10(c)).
 *
 * Each entry hashes its own canonical payload together with the hash of the
 * previous entry in the same daily chain, so altering or removing any historic
 * row breaks every hash after it. Chains are partitioned per UTC day, which
 * bounds how much has to be re-walked to verify a period and leaves a
 * verifiable head per day.
 *
 * Chaining happens after the write, in lib/audit-seal.ts — never on the request
 * path. See the note there for why.
 */

/** Chain partition key for an instant — UTC calendar day, e.g. "2026-07-23". */
export const chainKeyFor = (at: Date): string => at.toISOString().slice(0, 10);

/**
 * Deterministic JSON: keys sorted, undefined dropped, dates as ISO strings.
 * Verification must reproduce the exact bytes that were hashed at write time,
 * so key order can never be left to object-construction order.
 */
export const canonicalJson = (value: unknown): string => {
  const norm = (v: unknown): unknown => {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'bigint') return v.toString();
    if (Array.isArray(v)) return v.map(norm);
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        const nv = norm((v as Record<string, unknown>)[k]);
        if (nv !== null) out[k] = nv;
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(norm(value));
};

/** The fields covered by the hash. Anything not listed here is not protected. */
export interface HashablePayload {
  entityType: string;
  entityId: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  diff?: unknown;
  reason?: string | null;
  reasonCode?: string | null;
  userId?: string | null;
  userName: string;
  actorType: string;
  sessionId?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
}

export const computeHash = (payload: HashablePayload, prevHash: string | null): string =>
  createHash('sha256')
    .update(canonicalJson({ ...payload, prevHash: prevHash ?? 'GENESIS' }))
    .digest('hex');

/** Correlates every audit entry emitted while handling one request. */
export const newRequestId = (): string => randomUUID();
