import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { getAuditContext, type AuditContext } from './audit-context';
import { chainKeyFor, computeHash } from './audit-hash';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'SOFT_DELETE'
  | 'RESTORE'
  | 'TRANSITION'
  | 'APPROVE'
  | 'REJECT'
  | 'SIGN'
  | 'SCORE'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'LOCKOUT'
  | 'PASSWORD_CHANGE'
  | 'PIN_ENROLL'
  | 'PERMISSION_GRANT'
  | 'PERMISSION_REVOKE'
  | 'ROLE_CHANGE'
  | 'VIEW'
  | 'EXPORT'
  | 'PRINT'
  | 'DOWNLOAD'
  | 'IMPORT'
  | 'ARCHIVE'
  | 'CONFIG_CHANGE';

export type AuditModule = 'QMS' | 'DMS' | 'LIMS' | 'LMS' | 'WORKFLOW' | 'ADMIN' | 'SECURITY';

export interface AuditInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  entityLabel?: string | null;
  module?: AuditModule;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  valueType?: string | null;
  diff?: Prisma.InputJsonValue;
  criticality?: 'NORMAL' | 'CRITICAL';
  reason?: string | null;
  reasonCode?: string | null;
  signatureId?: string | null;
}

export interface AuditOptions {
  /**
   * Transaction the business write is running in. Passing it is what makes the
   * change and its trail atomic — without it a rollback leaves a phantom entry
   * and a crash leaves an unaudited change.
   */
  tx?: Prisma.TransactionClient;
  /** Explicit actor, when no ambient context exists (jobs, scripts, tests). */
  userId?: string;
  context?: Partial<AuditContext>;
  /**
   * Root client to open the audit transaction on. The automatic interceptor
   * passes the unextended base client so its own writes do not re-enter the
   * extension pipeline.
   */
  client?: PrismaClient;
}

type Db = Prisma.TransactionClient | PrismaClient;

/**
 * Actor details are looked up once and cached on the context, so a request
 * writing 30 entries pays for one query rather than 30. `_hydrated` is a flag
 * rather than an is-field-set check because the fields are legitimately null
 * for users with no employee id, role or department.
 */
const hydrateActor = async (db: Db, ctx: AuditContext): Promise<void> => {
  if (!ctx.userId || ctx._hydrated) return;
  const u = await db.user.findUnique({
    where: { id: ctx.userId },
    select: {
      name: true,
      employeeId: true,
      role: { select: { name: true } },
      department: { select: { name: true } },
    },
  });
  ctx._hydrated = true;
  ctx.userName = u?.name ?? ctx.userName ?? 'unknown';
  ctx.userEmployeeId = u?.employeeId ?? undefined;
  ctx.userRole = u?.role?.name;
  ctx.userDepartment = u?.department?.name;
};

const resolveContext = (opts?: AuditOptions): AuditContext => {
  const ambient = getAuditContext();
  const base: AuditContext = ambient
    ? { ...ambient }
    : { userName: 'system', actorType: 'SYSTEM', source: 'API' };
  if (opts?.userId) base.userId = opts.userId;
  return { ...base, ...opts?.context };
};

/**
 * Append one immutable audit entry.
 *
 * Failures are **not** swallowed. A trail write that silently fails leaves the
 * system claiming a completeness it does not have, so an error here rolls the
 * caller's transaction back: no audit record, no change.
 *
 * The entry is written **unsealed** — `hash`/`prevHash` are filled in later by
 * `sealPendingEntries` (lib/audit-seal.ts). Chaining on the write path required
 * serialising every writer behind one advisory lock per day, and because
 * `pg_advisory_xact_lock` is transaction-scoped, joining a caller's transaction
 * held that lock for the caller's *entire* duration — a single slow workflow
 * transition then blocked every other write in the application. Sealing after
 * the fact keeps the chain (and its tamper evidence) without putting a global
 * lock in front of every request.
 */
export const recordAudit = async (input: AuditInput, opts?: AuditOptions): Promise<string> => {
  const run = async (db: Prisma.TransactionClient): Promise<string> => {
    const ctx = resolveContext(opts);
    await hydrateActor(db, ctx);

    const createdAt = new Date();

    const entry = await db.auditTrailEntry.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        field: input.field ?? null,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        diff: input.diff ?? undefined,
        reason: input.reason ?? ctx.reason ?? null,
        reasonCode: input.reasonCode ?? ctx.reasonCode ?? null,
        userId: ctx.userId ?? null,
        userName: ctx.userName,
        actorType: ctx.actorType,
        sessionId: ctx.sessionId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        createdAt,
        entityLabel: input.entityLabel ?? null,
        module: input.module ?? null,
        valueType: input.valueType ?? null,
        criticality: input.criticality ?? 'NORMAL',
        signatureId: input.signatureId ?? null,
        userEmployeeId: ctx.userEmployeeId ?? null,
        userRole: ctx.userRole ?? null,
        userDepartment: ctx.userDepartment ?? null,
        onBehalfOfId: ctx.onBehalfOfId ?? null,
        userAgent: ctx.userAgent ?? null,
        requestId: ctx.requestId ?? null,
        source: ctx.source,
        clientTzOffsetMin: ctx.clientTzOffsetMin ?? null,
        chainKey: chainKeyFor(createdAt),
      },
      select: { id: true },
    });
    return entry.id;
  };

  // Join the caller's transaction when there is one, so the entry and the change
  // it describes commit or roll back together. Otherwise write directly: a
  // single insert is already atomic, and opening a transaction here would take a
  // second pool connection per entry — which, with the business write holding
  // the first, is how the pool starves under load.
  if (opts?.tx) return run(opts.tx);
  return run((opts?.client ?? prisma) as unknown as Prisma.TransactionClient);
};

/**
 * Diff two versions of a record into one entry per changed field.
 * `fields` is explicit: an allowlist keeps secrets and derived columns out of
 * the trail, and makes the audited surface reviewable.
 */
export const recordFieldDiff = async (
  base: Omit<AuditInput, 'field' | 'oldValue' | 'newValue' | 'action'>,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
  opts?: AuditOptions,
): Promise<void> => {
  const asString = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  for (const field of fields) {
    if (!(field in after)) continue;
    const oldValue = asString(before[field]);
    const newValue = asString(after[field]);
    if (oldValue === newValue) continue;
    await recordAudit(
      {
        ...base,
        action: 'UPDATE',
        field,
        oldValue,
        newValue,
        valueType: typeof after[field] === 'number' ? 'number' : typeof after[field],
      },
      opts,
    );
  }
};
