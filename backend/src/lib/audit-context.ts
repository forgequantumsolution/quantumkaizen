import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Ambient identity + provenance for the current unit of work, carried without
 * threading an extra argument through every service signature.
 *
 * ALCOA++ "Attributable" needs more than a userId: the trail must survive the
 * user being renamed, moved or deleted, so identity is snapshotted here at
 * request time and denormalised onto each audit entry.
 */
export type ActorType = 'USER' | 'SYSTEM' | 'JOB' | 'INTEGRATION';
export type AuditSource = 'WEB' | 'API' | 'JOB' | 'IMPORT';

export interface AuditContext {
  userId?: string;
  userName: string;
  userEmail?: string;
  userEmployeeId?: string;
  userRole?: string;
  userDepartment?: string;
  onBehalfOfId?: string;
  actorType: ActorType;
  source: AuditSource;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  /** Reason-for-change supplied by the caller (X-Change-Reason header or body.reason). */
  reason?: string;
  reasonCode?: string;
  clientTzOffsetMin?: number;
  /** Set once the actor snapshot (employee id, role, department) is loaded. */
  _hydrated?: boolean;
}

const storage = new AsyncLocalStorage<AuditContext>();

/** Run `fn` with `ctx` as the ambient audit context. */
export const runWithAuditContext = <T>(ctx: AuditContext, fn: () => T): T =>
  storage.run(ctx, fn);

/** The ambient context, or undefined outside a request/job scope. */
export const getAuditContext = (): AuditContext | undefined => storage.getStore();

/**
 * Context for unattended work (cron sweeps, workers, migrations). Actions still
 * have to be attributable — to a named system actor rather than to nobody.
 */
export const systemContext = (name: string, actorType: ActorType = 'JOB'): AuditContext => ({
  userName: name,
  actorType,
  source: actorType === 'JOB' ? 'JOB' : 'API',
});

/** Run `fn` as a named system/job actor. */
export const runAsSystem = <T>(name: string, fn: () => T, actorType: ActorType = 'JOB'): T =>
  runWithAuditContext(systemContext(name, actorType), fn);

/**
 * Attach a reason-for-change to the ambient context for the duration of `fn`.
 * Used by the requireReason middleware and by services that derive a reason
 * from the operation itself (e.g. a cancellation comment).
 */
export const withReason = <T>(reason: string, fn: () => T, reasonCode?: string): T => {
  const current = getAuditContext();
  if (!current) return runWithAuditContext({ ...systemContext('system'), reason, reasonCode }, fn);
  return runWithAuditContext({ ...current, reason, reasonCode }, fn);
};
