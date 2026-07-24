import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { verifyChain } from '../../lib/audit-seal';

/**
 * Read side of the audit trail.
 *
 * A trail nobody can read is not evidence, so this is the surface an auditor
 * actually uses: filter by who/what/when/where, and read the change history of
 * any single record.
 */

export interface TrailQuery {
  entity_type?: string;
  entity_id?: string;
  module?: string;
  action?: string;
  criticality?: 'NORMAL' | 'CRITICAL';
  user?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

const buildWhere = (q: TrailQuery): Prisma.AuditTrailEntryWhereInput => {
  const where: Prisma.AuditTrailEntryWhereInput = {};
  if (q.entity_type) where.entityType = q.entity_type;
  if (q.entity_id) where.entityId = q.entity_id;
  if (q.module) where.module = q.module;
  if (q.action) where.action = q.action;
  if (q.criticality) where.criticality = q.criticality;
  if (q.user) {
    where.OR = [
      { userName: { contains: q.user, mode: 'insensitive' } },
      { userId: q.user },
    ];
  }
  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to ? { lte: new Date(q.to) } : {}),
    };
  }
  if (q.search) {
    where.AND = [
      {
        OR: [
          { entityLabel: { contains: q.search, mode: 'insensitive' } },
          { entityId: { contains: q.search, mode: 'insensitive' } },
          { field: { contains: q.search, mode: 'insensitive' } },
          { oldValue: { contains: q.search, mode: 'insensitive' } },
          { newValue: { contains: q.search, mode: 'insensitive' } },
          { reason: { contains: q.search, mode: 'insensitive' } },
        ],
      },
    ];
  }
  return where;
};

/** Shape shared by the list and the per-record history, so one UI renders both. */
const toDto = (t: {
  id: string; seq: bigint; entityType: string; entityId: string; entityLabel: string | null;
  module: string | null; action: string; field: string | null; oldValue: string | null;
  newValue: string | null; reason: string | null; criticality: string; userName: string;
  userId: string | null; userRole: string | null; userDepartment: string | null;
  actorType: string; ipAddress: string | null; sessionId: string | null;
  requestId: string | null; source: string | null; createdAt: Date; hash: string | null;
  diff: Prisma.JsonValue | null;
}) => ({
  id: t.id,
  seq: String(t.seq),
  entity_type: t.entityType,
  entity_id: t.entityId,
  entity_label: t.entityLabel,
  module: t.module,
  action: t.action,
  field: t.field,
  old_value: t.oldValue,
  new_value: t.newValue,
  reason: t.reason,
  criticality: t.criticality,
  user_name: t.userName,
  user_id: t.userId,
  user_role: t.userRole,
  user_department: t.userDepartment,
  actor_type: t.actorType,
  ip_address: t.ipAddress,
  session_id: t.sessionId,
  request_id: t.requestId,
  source: t.source,
  created_at: t.createdAt,
  // Presence of a hash tells the reader whether the entry is chained yet, without
  // exposing the digest itself.
  sealed: t.hash !== null,
  diff: t.diff,
});

export const listTrail = async (q: TrailQuery) => {
  const take = Math.min(q.page_size ?? 25, 200);
  const page = Math.max(q.page ?? 1, 1);
  const where = buildWhere(q);

  const [total, rows] = await Promise.all([
    prisma.auditTrailEntry.count({ where }),
    prisma.auditTrailEntry.findMany({
      where,
      orderBy: { seq: 'desc' },
      take,
      skip: (page - 1) * take,
    }),
  ]);

  return {
    data: rows.map(toDto),
    meta: { total, page, page_size: take, pages: Math.ceil(total / take) },
  };
};

/** Full history for one record — what the History tab on a detail page shows. */
export const entityHistory = async (entityType: string, entityId: string) => {
  const rows = await prisma.auditTrailEntry.findMany({
    where: { entityType, entityId },
    orderBy: { seq: 'desc' },
    take: 500,
  });
  return { data: rows.map(toDto) };
};

/** Distinct values actually present, so filters never offer an empty result. */
export const trailFacets = async () => {
  const [entityTypes, actions, modules] = await Promise.all([
    prisma.auditTrailEntry.findMany({
      distinct: ['entityType'], select: { entityType: true }, orderBy: { entityType: 'asc' },
    }),
    prisma.auditTrailEntry.findMany({
      distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' },
    }),
    prisma.auditTrailEntry.findMany({
      distinct: ['module'], select: { module: true }, orderBy: { module: 'asc' },
    }),
  ]);
  return {
    data: {
      entity_types: entityTypes.map((e) => e.entityType),
      actions: actions.map((a) => a.action),
      modules: modules.map((m) => m.module).filter((m): m is string => !!m),
    },
  };
};

/** Chain verification status — the integrity evidence, on demand. */
export const chainStatus = async () => {
  const result = await verifyChain();
  return {
    data: {
      intact: result.intact,
      checked: result.checked,
      unsealed: result.unsealed,
      breaks: result.breaks.slice(0, 50),
    },
  };
};

/** CSV for offline review. The export itself is audited by the route. */
export const exportCsv = async (q: TrailQuery): Promise<string> => {
  const rows = await prisma.auditTrailEntry.findMany({
    where: buildWhere(q),
    orderBy: { seq: 'desc' },
    take: 10_000,
  });

  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = [
    'seq', 'timestamp', 'module', 'entity_type', 'entity_id', 'entity_label',
    'action', 'field', 'old_value', 'new_value', 'reason', 'criticality',
    'user_name', 'user_role', 'actor_type', 'ip_address', 'session_id', 'sealed',
  ];
  const lines = [header.join(',')];
  for (const t of rows) {
    lines.push([
      cell(t.seq), cell(t.createdAt), cell(t.module), cell(t.entityType), cell(t.entityId),
      cell(t.entityLabel), cell(t.action), cell(t.field), cell(t.oldValue), cell(t.newValue),
      cell(t.reason), cell(t.criticality), cell(t.userName), cell(t.userRole),
      cell(t.actorType), cell(t.ipAddress), cell(t.sessionId), cell(t.hash !== null),
    ].join(','));
  }
  return lines.join('\n');
};
