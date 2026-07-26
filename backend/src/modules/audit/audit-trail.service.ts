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
// The Prisma row carries every column; the list and history queries don't
// `select`, so the full record reaches here and the detail drawer can show all
// of it. Typed loosely because both call sites pass the whole entity.
const toDto = (t: Prisma.AuditTrailEntryGetPayload<Record<string, never>>) => ({
  id: t.id,
  seq: String(t.seq),
  entity_type: t.entityType,
  entity_id: t.entityId,
  entity_label: t.entityLabel,
  module: t.module,
  action: t.action,
  field: t.field,
  value_type: t.valueType,
  old_value: t.oldValue,
  new_value: t.newValue,
  reason: t.reason,
  reason_code: t.reasonCode,
  criticality: t.criticality,
  user_name: t.userName,
  user_id: t.userId,
  user_role: t.userRole,
  user_department: t.userDepartment,
  user_employee_id: t.userEmployeeId,
  on_behalf_of_id: t.onBehalfOfId,
  actor_type: t.actorType,
  ip_address: t.ipAddress,
  user_agent: t.userAgent,
  session_id: t.sessionId,
  request_id: t.requestId,
  source: t.source,
  created_at: t.createdAt,
  client_tz_offset_min: t.clientTzOffsetMin,
  signature_id: t.signatureId,
  // The hash is tamper evidence, not a secret — exposing it lets a reviewer
  // confirm the chain independently. `sealed` is the cheap boolean for the row.
  chain_key: t.chainKey,
  prev_hash: t.prevHash,
  hash: t.hash,
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

/**
 * Timezone the export's human-readable timestamp column is rendered in.
 *
 * One declared zone per deployment, named in the column header, so two
 * reviewers reading the same file never disagree about when something happened.
 */
const REPORT_TZ = process.env.AUDIT_REPORT_TZ ?? 'Asia/Kolkata';
const REPORT_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

/**
 * Column layout of the export, grouped exactly like the detail drawer.
 *
 * The export is the offline copy of the trail, so it carries every field the
 * drawer shows — an auditor working from the file must never have to come back
 * to the screen for the rest of the record.
 */
const EXPORT_GROUPS: Array<[group: string, columns: string[]]> = [
  ['WHAT CHANGED', [
    'Record Type', 'Record', 'Record ID', 'Module', 'Action',
    'Field Changed', 'Old Value', 'New Value', 'Value Type', 'Criticality',
  ]],
  ['WHY', ['Reason', 'Reason Code', 'E-Signature ID']],
  ['WHO', [
    'User', 'Role', 'Department', 'Employee ID',
    'Actor Type', 'User ID (System)', 'On Behalf Of',
  ]],
  ['WHEN & WHERE', [
    'Timestamp (UTC)', `Timestamp (${REPORT_TZ})`, 'Actor Timezone', 'IP Address',
    'Source', 'Session ID', 'Request ID', 'User Agent',
  ]],
  ['INTEGRITY', [
    'Status', 'Sequence', 'Chain (day)', 'Sealed', 'Hash (SHA-256)', 'Prev Hash',
  ]],
  ['RECORD SNAPSHOT', ['Full Record Snapshot (JSON)']],
];

/**
 * The same instant in the site's reporting timezone.
 *
 * UTC alone is unreadable to a reviewer working local hours, and the actor's
 * own offset is only known when the browser sent it — so the second timestamp
 * is anchored to one declared zone that is always populated and DST-correct.
 */
const reportStamp = (at: Date): string => {
  const p = Object.fromEntries(
    REPORT_FMT.formatToParts(at).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};

/**
 * The actor's own UTC offset, when the browser reported it.
 *
 * `clientTzOffsetMin` follows `getTimezoneOffset()` (UTC minus local), hence
 * the sign flip. Blank means the client never sent it — which is a fact about
 * the record, not something to paper over with the server's zone.
 */
const actorTz = (offsetMin: number | null): string => {
  if (offsetMin === null || offsetMin === undefined) return '';
  const abs = Math.abs(offsetMin);
  return `UTC${offsetMin <= 0 ? '+' : '-'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

/** CSV for offline review. The export itself is audited by the route. */
export const exportCsv = async (q: TrailQuery): Promise<string> => {
  const rows = await prisma.auditTrailEntry.findMany({
    where: buildWhere(q),
    orderBy: { seq: 'desc' },
    take: 10_000,
  });

  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '""';
    const raw = v instanceof Date ? v.toISOString() : String(v);
    // Spreadsheets treat a leading =, +, - or @ as a formula. An audit export is
    // evidence, not a program: neutralise it so the cell reads back verbatim.
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const snapshot = (diff: unknown): string => {
    if (diff === null || diff === undefined) return '';
    try {
      return JSON.stringify(diff);
    } catch {
      return String(diff);
    }
  };

  // Two header rows: the group band, then the column names — the same reading
  // order as the drawer's sections.
  const groupRow: string[] = [];
  const columnRow: string[] = [];
  for (const [group, columns] of EXPORT_GROUPS) {
    columns.forEach((col, i) => {
      groupRow.push(cell(i === 0 ? group : ''));
      columnRow.push(cell(col));
    });
  }

  const lines = [groupRow.join(','), columnRow.join(',')];

  for (const t of rows) {
    lines.push([
      // WHAT CHANGED
      cell(t.entityType),
      cell(t.entityLabel ?? t.entityId),
      cell(t.entityId),
      cell(t.module),
      cell(t.action.replace(/_/g, ' ')),
      cell(t.field),
      cell(t.oldValue),
      cell(t.newValue),
      cell(t.valueType),
      cell(t.criticality),
      // WHY
      cell(t.reason),
      cell(t.reasonCode),
      cell(t.signatureId),
      // WHO
      cell(t.userName),
      cell(t.userRole),
      cell(t.userDepartment),
      cell(t.userEmployeeId),
      cell(t.actorType),
      cell(t.userId),
      cell(t.onBehalfOfId),
      // WHEN & WHERE
      cell(t.createdAt),
      cell(reportStamp(t.createdAt)),
      cell(actorTz(t.clientTzOffsetMin)),
      cell(t.ipAddress),
      cell(t.source),
      cell(t.sessionId),
      cell(t.requestId),
      cell(t.userAgent),
      // INTEGRITY
      cell(t.hash !== null
        ? 'Chained — alteration would be detectable'
        : 'Awaiting the next chain seal'),
      cell(t.seq),
      cell(t.chainKey),
      cell(t.hash !== null ? 'TRUE' : 'FALSE'),
      cell(t.hash),
      cell(t.prevHash),
      // RECORD SNAPSHOT
      cell(snapshot(t.diff)),
    ].join(','));
  }

  // BOM + CRLF so Excel opens the file as UTF-8 without an import dialog.
  return '﻿' + lines.join('\r\n');
};
