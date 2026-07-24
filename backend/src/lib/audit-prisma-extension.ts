import { Prisma, type PrismaClient } from '@prisma/client';
import { recordAudit, type AuditAction } from './audit';
import {
  IGNORED_FIELDS,
  REDACTED_FIELDS,
  criticalityFor,
  isAutoAudited,
  labelFor,
  moduleFor,
} from './audit-scope';

/**
 * Automatic audit capture at the data-access layer.
 *
 * Coverage that depends on developers remembering to call a helper decays: the
 * pre-existing hand-written trail reached LIMS/LMS/DMS thoroughly and left the
 * ticket, workflow and RBAC modules with nothing. Intercepting writes makes
 * coverage structural — a model is audited because it is in scope, not because
 * someone remembered.
 *
 * Ordering and atomicity. The business write runs first; its audit entry is
 * written immediately afterwards, and a failure to write the entry propagates
 * to the caller. Where the caller is not already inside a transaction this
 * leaves one residual case — the business write commits, the audit write fails,
 * and the caller sees an error — which is deliberately the loud failure rather
 * than a silent gap. Operations needing true atomicity call `recordAudit` with
 * the surrounding `tx` directly; the interceptor does not attempt to open a
 * transaction around `query()`, which Prisma binds to its own client.
 */

type Row = Record<string, unknown>;

const idOf = (row: Row | null | undefined): string | null => {
  const id = row?.id;
  return typeof id === 'string' ? id : typeof id === 'number' ? String(id) : null;
};

const asString = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** Prisma write-operator objects ({ set }, { increment }, { connect } …). */
const isOperatorObject = (v: unknown): boolean =>
  typeof v === 'object' && v !== null && !(v instanceof Date) && !Array.isArray(v);

/**
 * Fields worth diffing: those the caller actually addressed, minus redacted
 * credentials, bookkeeping columns, and nested relation writes (which are
 * captured as their own events when the related model is itself in scope).
 */
const candidateFields = (data: Row | undefined): string[] => {
  if (!data) return [];
  return Object.keys(data).filter(
    (k) => !REDACTED_FIELDS.has(k) && !IGNORED_FIELDS.has(k) && !isOperatorObject(data[k]),
  );
};

const diffFields = (before: Row | null, after: Row | null, fields: string[]) => {
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null; valueType: string }> = [];
  for (const f of fields) {
    const oldValue = asString(before?.[f]);
    const newValue = asString(after?.[f] ?? before?.[f] ?? null);
    if (oldValue === newValue) continue;
    changes.push({ field: f, oldValue, newValue, valueType: typeof (after?.[f] ?? before?.[f]) });
  }
  return changes;
};

/**
 * Soft deletes are the more common shape here (49 models carry `isDeleted`), and
 * they arrive as an ordinary update. Recording them as UPDATE would hide
 * deletions from anyone filtering the trail for them.
 */
const deletionAction = (data: Row | undefined, before: Row | null): AuditAction | null => {
  if (!data) return null;
  if (data.isDeleted === true && before?.isDeleted !== true) return 'SOFT_DELETE';
  if (data.isDeleted === false && before?.isDeleted === true) return 'RESTORE';
  return null;
};

export const createAuditExtension = (base: PrismaClient) => {
  /** Reads the before-image on the base client, outside the extension pipeline. */
  const model = (name: string) =>
    (base as unknown as Record<string, {
      findUnique: (a: unknown) => Promise<Row | null>;
      findMany: (a: unknown) => Promise<Row[]>;
    }>)[name.charAt(0).toLowerCase() + name.slice(1)];

  const emit = async (
    modelName: string,
    entityId: string,
    action: AuditAction,
    extra: Partial<Parameters<typeof recordAudit>[0]> = {},
    label?: string | null,
  ) => {
    await recordAudit(
      {
        entityType: modelName,
        entityId,
        action,
        module: moduleFor(modelName),
        criticality: criticalityFor(modelName),
        entityLabel: label ?? null,
        ...extra,
      },
      { client: base },
    );
  };

  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'auditTrail',
      query: {
        $allModels: {
          async create({ model: m, args, query }) {
            const result = (await query(args)) as Row;
            if (!isAutoAudited(m)) return result;
            const id = idOf(result);
            if (id) await emit(m, id, 'CREATE', {}, labelFor(result));
            return result;
          },

          async update({ model: m, args, query }) {
            if (!isAutoAudited(m)) return query(args);
            const a = args as { where: unknown; data?: Row };
            const before = await model(m).findUnique({ where: a.where }).catch(() => null);
            const result = (await query(args)) as Row;

            const id = idOf(result) ?? idOf(before);
            if (!id) return result;
            const label = labelFor(result) ?? labelFor(before);

            const softDelete = deletionAction(a.data, before);
            if (softDelete) {
              await emit(m, id, softDelete, {}, label);
              return result;
            }
            for (const c of diffFields(before, result, candidateFields(a.data))) {
              await emit(m, id, 'UPDATE', c, label);
            }
            return result;
          },

          async upsert({ model: m, args, query }) {
            if (!isAutoAudited(m)) return query(args);
            const a = args as { where: unknown; update?: Row };
            const before = await model(m).findUnique({ where: a.where }).catch(() => null);
            const result = (await query(args)) as Row;
            const id = idOf(result);
            if (!id) return result;
            const label = labelFor(result);

            if (!before) {
              await emit(m, id, 'CREATE', {}, label);
              return result;
            }
            for (const c of diffFields(before, result, candidateFields(a.update))) {
              await emit(m, id, 'UPDATE', c, label);
            }
            return result;
          },

          async delete({ model: m, args, query }) {
            if (!isAutoAudited(m)) return query(args);
            const a = args as { where: unknown };
            const before = await model(m).findUnique({ where: a.where }).catch(() => null);
            const result = (await query(args)) as Row;
            const id = idOf(result) ?? idOf(before);
            if (id) {
              // The whole row goes into `diff`: once it is gone from the table,
              // the trail is the only remaining copy of what was destroyed.
              await emit(
                m,
                id,
                'DELETE',
                { diff: redactRow(before) as Prisma.InputJsonValue },
                labelFor(before),
              );
            }
            return result;
          },

          async updateMany({ model: m, args, query }) {
            if (!isAutoAudited(m)) return query(args);
            const a = args as { where?: unknown; data?: Row };
            const before = await model(m).findMany({ where: a.where ?? {} }).catch(() => [] as Row[]);
            const result = await query(args);
            const ids = before.map(idOf).filter((x): x is string => !!x);
            if (!ids.length) return result;

            const after = await model(m)
              .findMany({ where: { id: { in: ids } } })
              .catch(() => [] as Row[]);
            const afterById = new Map(after.map((r) => [idOf(r), r]));

            for (const b of before) {
              const id = idOf(b);
              if (!id) continue;
              const row = afterById.get(id) ?? null;
              const softDelete = deletionAction(a.data, b);
              if (softDelete) {
                await emit(m, id, softDelete, {}, labelFor(b));
                continue;
              }
              for (const c of diffFields(b, row, candidateFields(a.data))) {
                await emit(m, id, 'UPDATE', c, labelFor(row) ?? labelFor(b));
              }
            }
            return result;
          },

          async deleteMany({ model: m, args, query }) {
            if (!isAutoAudited(m)) return query(args);
            const a = args as { where?: unknown };
            const before = await model(m).findMany({ where: a.where ?? {} }).catch(() => [] as Row[]);
            const result = await query(args);
            for (const b of before) {
              const id = idOf(b);
              if (id) {
                await emit(m, id, 'DELETE', { diff: redactRow(b) as Prisma.InputJsonValue }, labelFor(b));
              }
            }
            return result;
          },
        },
      },
    }),
  );
};

/** Strips credentials from a row before it is preserved in the trail. */
const redactRow = (row: Row | null): Row => {
  if (!row) return {};
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (REDACTED_FIELDS.has(k)) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
};
