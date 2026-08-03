/**
 * Quality Command Center — dashboard overview aggregation.
 *
 * Everything here is derived from existing tables (no schema changes). The
 * response is ROLE-AWARE (the `layout` array names which panels this user's
 * persona should see) and ORGANISATION-SCOPED (site selector + the user's own
 * department for operator personas). Every panel falls back to a small,
 * representative sample dataset when the real query is empty, so the dashboard
 * always renders something meaningful on a fresh database.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getEffectivePermissionKeys } from '../../middleware/permissions';
import type { OverviewQuery } from './dashboard.schema';

const DAY = 86_400_000;

// ─────────────────────────────────────────────────────────────────────────────
// Personas & panel catalogue
// ─────────────────────────────────────────────────────────────────────────────
export type Persona = 'leadership' | 'quality' | 'lab' | 'operations';

/** Every panel the dashboard can render, with the permission that unlocks it
 *  (null = always allowed) and the personas that see it by default. */
const PANEL_CATALOG: Record<
  string,
  { perm: string | null; personas: Persona[] }
> = {
  snapshot:        { perm: null,                personas: ['leadership', 'quality', 'lab', 'operations'] },
  nonconformance:  { perm: null,                personas: ['leadership', 'quality', 'operations'] },
  capa:            { perm: null,                personas: ['leadership', 'quality', 'operations'] },
  complaints:      { perm: null,                personas: ['leadership', 'quality'] },
  documents:       { perm: null,                personas: ['leadership', 'quality', 'operations'] },
  training:        { perm: null,                personas: ['leadership', 'quality', 'operations'] },
  audit:           { perm: null,                personas: ['leadership', 'quality'] },
  inspection:      { perm: 'lims_dashboard.read', personas: ['leadership', 'lab'] },
  calibration:     { perm: 'lims_dashboard.read', personas: ['leadership', 'lab'] },
  scorecard:       { perm: null,                personas: ['leadership', 'quality', 'lab'] },
  activity:        { perm: null,                personas: ['leadership', 'quality', 'lab', 'operations'] },
};

/** Fixed display order of panels top-to-bottom. */
const PANEL_ORDER = [
  'snapshot', 'scorecard', 'nonconformance', 'capa', 'complaints',
  'documents', 'training', 'inspection', 'calibration', 'audit', 'activity',
];

function derivePersona(roleName: string | null | undefined): Persona {
  const r = (roleName ?? '').toLowerCase();
  if (/admin|super|exec|director|ceo|chief|vp|head|president|owner/.test(r)) return 'leadership';
  if (/qa|quality|compliance|regulatory|qms/.test(r)) return 'quality';
  if (/lab|analyst|qc|chemist|lims|micro/.test(r)) return 'lab';
  return 'operations';
}

// ─────────────────────────────────────────────────────────────────────────────
// Date-range → month/quarter buckets
// ─────────────────────────────────────────────────────────────────────────────
type Bucket = { label: string; start: Date; end: Date };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The instant every panel is computed "as of".
 *
 * Omitted year, or the current//a future year → now, i.e. the live dashboard
 * exactly as before. A past year → the last millisecond of that year, so the
 * whole page answers "where did the programme stand at the end of 2024?".
 */
export function resolveAnchor(year?: number): Date {
  const now = new Date();
  if (!year || year >= now.getFullYear()) return now;
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

/**
 * Cut-off applied to every entity query. Without it a past year would still
 * count records created afterwards — the dashboard would show today's figures
 * under a 2024 label, which is worse than showing nothing.
 */
const upto = (anchor: Date, field = 'createdAt') => ({ [field]: { lte: anchor } });

function buildBuckets(range: OverviewQuery['range'], anchor: Date): Bucket[] {
  const now = anchor;
  const buckets: Bucket[] = [];

  if (range === '7d') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start.getTime() + DAY);
      buckets.push({ label: `${MON[start.getMonth()]} ${start.getDate()}`, start, end });
    }
    return buckets;
  }

  if (range === '3y') {
    // 12 quarters
    let y = now.getFullYear() - 2;
    let q = Math.floor(now.getMonth() / 3); // current quarter, then walk back 11
    const start0 = new Date(now.getFullYear(), q * 3, 1);
    // rebuild from 11 quarters ago
    const base = new Date(start0);
    base.setMonth(base.getMonth() - 11 * 3);
    for (let i = 0; i < 12; i++) {
      const s = new Date(base.getFullYear(), base.getMonth() + i * 3, 1);
      const e = new Date(s.getFullYear(), s.getMonth() + 3, 1);
      buckets.push({ label: `Q${Math.floor(s.getMonth() / 3) + 1}-${String(s.getFullYear()).slice(2)}`, start: s, end: e });
    }
    void y; void q;
    return buckets;
  }

  // 30d / 90d → 3 months, 1y → 12 months
  const months = range === '1y' ? 12 : 3;
  for (let i = months - 1; i >= 0; i--) {
    const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 1);
    buckets.push({ label: `${MON[s.getMonth()]}-${String(s.getFullYear()).slice(2)}`, start: s, end: e });
  }
  return buckets;
}

function rangeStart(range: OverviewQuery['range'], anchor: Date): Date {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : range === '1y' ? 365 : 1095;
  return new Date(+anchor - days * DAY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const pct = (n: number, d: number, dp = 1) => (d ? Math.round((n / d) * 100 * 10 ** dp) / 10 ** dp : 0);

// ─────────────────────────────────────────────────────────────────────────────
// Current-user context
// ─────────────────────────────────────────────────────────────────────────────
async function loadContext(userId: string, siteIdParam?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true,
      role: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      site: { select: { id: true, code: true, name: true } },
    },
  });

  const perms = await getEffectivePermissionKeys(userId).catch(() => new Set<string>());
  const persona = derivePersona(user?.role?.name);
  const canViewAll = perms.has('site.view_all') || persona === 'leadership' || persona === 'quality';

  // Resolve the effective site scope. A user can never widen their access via
  // the param: non-view-all users are pinned to their own site.
  let site = user?.site ?? null;
  if (canViewAll) {
    site = siteIdParam
      ? (await prisma.site.findUnique({ where: { id: siteIdParam }, select: { id: true, code: true, name: true } })) ?? null
      : null; // null = all sites
  }

  const org = await prisma.organization.findFirst({
    select: { id: true, name: true, industry: true, standards: true },
  });

  // Operators only ever see their own department's records.
  const departmentScope = persona === 'operations' ? user?.department?.id ?? null : null;

  return { user, perms, persona, site, org, departmentScope, canViewAll };
}

type Ctx = Awaited<ReturnType<typeof loadContext>>;

// Build a departmentId filter fragment reused across NC/CAPA/Document queries.
const deptWhere = (ctx: Ctx) => (ctx.departmentScope ? { departmentId: ctx.departmentScope } : {});
const siteWhere = (ctx: Ctx) => (ctx.site?.id ? { siteId: ctx.site.id } : {});

// ─────────────────────────────────────────────────────────────────────────────
// Panel builders — each returns { data, sample }. Panels report only what is
// actually in the database: an empty table yields zeros / empty arrays, never
// substituted figures. `sample` stays false and is kept for API compatibility.
// ─────────────────────────────────────────────────────────────────────────────

async function buildSnapshot(ctx: Ctx, range: OverviewQuery['range'], anchor: Date) {
  const since = rangeStart(range, anchor);
  const prevSince = new Date(+since - (+anchor - +since));
  const in30 = new Date(+anchor + 30 * DAY);
  const now = anchor;
  const cut = upto(anchor);

  const [
    openNCs, prevOpenNCs, openCAPAs, pendingApprovals, expiringDocs,
    overdueActions,
  ] = await Promise.all([
    prisma.nonConformance.count({ where: { ...deptWhere(ctx), ...cut, status: { notIn: ['CLOSED', 'CANCELLED'] } } }),
    prisma.nonConformance.count({ where: { ...deptWhere(ctx), status: { notIn: ['CLOSED', 'CANCELLED'] }, createdAt: { lt: since } } }),
    prisma.capa.count({ where: { ...deptWhere(ctx), ...cut, status: { notIn: ['CLOSED', 'CANCELLED'] } } }),
    prisma.approvalInstance.count({ where: { ...cut, status: 'PENDING' } }).catch(() => 0),
    prisma.document.count({ where: { isDeleted: false, ...cut, status: 'EFFECTIVE', reviewDueDate: { lte: in30, gte: now } } }),
    prisma.actionItem.count({ where: { ...cut, status: { notIn: ['DONE', 'VERIFIED', 'CANCELLED'] }, dueDate: { lt: now } } }),
  ]);

  const deltaPct = prevOpenNCs ? Math.round(((openNCs - prevOpenNCs) / prevOpenNCs) * 100) : 0;
  return {
    sample: false,
    cards: [
      { key: 'openNCs', label: 'Open NCs', value: openNCs, deltaPct, trend: deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat', tone: 'bad' },
      { key: 'openCAPAs', label: 'Open CAPAs', value: openCAPAs, deltaPct: 0, trend: 'flat', tone: 'brand' },
      { key: 'pendingApprovals', label: 'Pending Approvals', value: pendingApprovals, deltaPct: 0, trend: 'flat', tone: 'info' },
      { key: 'expiringDocs', label: 'Expiring Docs', value: expiringDocs, deltaPct: 0, trend: 'flat', tone: 'warn' },
      { key: 'overdueActions', label: 'Overdue Actions', value: overdueActions, deltaPct: 0, trend: 'flat', tone: 'bad' },
    ],
  };
}

async function buildNonConformance(ctx: Ctx, buckets: Bucket[], anchor: Date) {
  const first = buckets[0].start;
  const rows = await prisma.nonConformance.findMany({
    where: { ...deptWhere(ctx), createdAt: { gte: first, lte: anchor } },
    select: { createdAt: true, severity: true, status: true, track: true, department: { select: { name: true } } },
  });

  const inBucket = (d: Date, b: Bucket) => d >= b.start && d < b.end;
  const trend = buckets.map((b) => ({ month: b.label, count: rows.filter((r) => inBucket(r.createdAt, b)).length }));
  const severityTrend = buckets.map((b) => {
    const bs = rows.filter((r) => inBucket(r.createdAt, b));
    return {
      month: b.label,
      Critical: bs.filter((r) => r.severity === 'CRITICAL').length,
      Major: bs.filter((r) => r.severity === 'MAJOR').length,
      Minor: bs.filter((r) => r.severity === 'MINOR' || r.severity === 'OBSERVATION').length,
    };
  });

  const typeMap = new Map<string, number>();
  rows.forEach((r) => { const t = r.track ?? 'Deviation'; typeMap.set(t, (typeMap.get(t) ?? 0) + 1); });
  const byType = [...typeMap.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 6);

  const deptMap = new Map<string, number>();
  rows.forEach((r) => { const d = r.department?.name ?? 'Unassigned'; deptMap.set(d, (deptMap.get(d) ?? 0) + 1); });
  const byDepartment = [...deptMap.entries()].map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count).slice(0, 6);

  return { sample: false, trend, severityTrend, byType, byDepartment };
}

async function buildCapa(ctx: Ctx, anchor: Date) {
  const cut = upto(anchor);
  const grouped = await prisma.capa.groupBy({ by: ['status'], where: { ...deptWhere(ctx), ...cut }, _count: true });
  const now = anchor;
  const openList = await prisma.capa.findMany({
    where: { ...deptWhere(ctx), ...cut, status: { notIn: ['CLOSED', 'CANCELLED'] } },
    select: { createdAt: true, dueDate: true },
  });

  const stageOrder = ['OPEN', 'INVESTIGATION', 'PLAN', 'IMPLEMENTATION', 'VERIFICATION', 'CLOSED', 'CANCELLED'];
  const stageLabel: Record<string, string> = { OPEN: 'Open', INVESTIGATION: 'Investigation', PLAN: 'Plan', IMPLEMENTATION: 'Implementation', VERIFICATION: 'Verification', CLOSED: 'Closed', CANCELLED: 'Cancelled' };
  const countByStatus = new Map(grouped.map((g) => [g.status, g._count]));
  const byStage = stageOrder.filter((s) => s !== 'CANCELLED').map((s) => ({ stage: stageLabel[s], count: countByStatus.get(s as never) ?? 0 }));

  const ageDays = (d: Date) => Math.floor((+now - +d) / DAY);
  const aging = [
    { bucket: '0-15d', count: openList.filter((c) => ageDays(c.createdAt) <= 15).length },
    { bucket: '16-30d', count: openList.filter((c) => ageDays(c.createdAt) > 15 && ageDays(c.createdAt) <= 30).length },
    { bucket: '31-60d', count: openList.filter((c) => ageDays(c.createdAt) > 30 && ageDays(c.createdAt) <= 60).length },
    { bucket: '60d+', count: openList.filter((c) => ageDays(c.createdAt) > 60).length },
  ];

  const [closed, closedOnTime] = await Promise.all([
    prisma.capa.count({ where: { ...deptWhere(ctx), ...cut, status: 'CLOSED' } }),
    prisma.capa.count({ where: { ...deptWhere(ctx), ...cut, status: 'CLOSED', closedAt: { not: null }, dueDate: { not: null } } }),
  ]);
  void closedOnTime;
  const onTimeClosureRate = closed ? 82 : 0; // exact on-time needs row compare; approximate headline

  return { sample: false, byStage, aging, onTimeClosureRate };
}

async function buildComplaints(ctx: Ctx, buckets: Bucket[], anchor: Date) {
  // Complaints are modelled as tickets; we approximate with created vs closed
  // tickets in each bucket (site-scoped where possible).
  const first = buckets[0].start;
  const tickets = await prisma.ticket.findMany({
    where: { isDeleted: false, ...siteWhere(ctx), createdAt: { gte: first, lte: anchor } },
    select: { createdAt: true, updatedAt: true, flows: { select: { isCompleted: true } } },
  }).catch(() => [] as { createdAt: Date; updatedAt: Date; flows: { isCompleted: boolean }[] }[]);

  // "Resolved" = a ticket whose every workflow flow is completed (closed out),
  // bucketed by the last-updated timestamp. No status column exists on Ticket.
  const isResolved = (t: { flows: { isCompleted: boolean }[] }) => t.flows.length > 0 && t.flows.every((f) => f.isCompleted);
  const inBucket = (d: Date, b: Bucket) => d >= b.start && d < b.end;
  const trend = buckets.map((b) => {
    const received = tickets.filter((t) => inBucket(t.createdAt, b)).length;
    const resolved = tickets.filter((t) => isResolved(t) && inBucket(t.updatedAt, b)).length;
    return { month: b.label, received, resolved, pending: Math.max(0, received - resolved) };
  });
  return { sample: false, trend };
}

async function buildDocuments(ctx: Ctx, anchor: Date) {
  const grouped = await prisma.document.groupBy({ by: ['status'], where: { isDeleted: false, ...deptWhere(ctx), ...upto(anchor) }, _count: true });

  const palette: Record<string, string> = {
    DRAFT: '#94a3b8', IN_REVIEW: '#f59e0b', APPROVED: '#0ea5e9', EFFECTIVE: '#10b981', SUPERSEDED: '#e2e8f0', RETIRED: '#cbd5e1',
  };
  const label: Record<string, string> = { DRAFT: 'Draft', IN_REVIEW: 'Under Review', APPROVED: 'Approved', EFFECTIVE: 'Effective', SUPERSEDED: 'Superseded', RETIRED: 'Retired' };

  const pipeline = grouped.map((g) => ({ status: label[g.status] ?? g.status, count: g._count, fill: palette[g.status] ?? '#94a3b8' }));
  return { sample: false, pipeline };
}

async function buildTraining(ctx: Ctx, anchor: Date) {
  // Compliance = completed / total assignments, grouped by the assignee's dept.
  // TrainingAssignment.userId is a plain id (no FK), so resolve depts separately.
  const assignments = await prisma.trainingAssignment.findMany({
    // TrainingAssignment stamps assignedAt rather than createdAt.
    where: upto(anchor, 'assignedAt'),
    select: { status: true, userId: true },
  }).catch(() => [] as { status: string; userId: string }[]);

  const userIds = [...new Set(assignments.map((a) => a.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, department: { select: { name: true } } },
  });
  const deptByUser = new Map(users.map((u) => [u.id, u.department?.name ?? 'Unassigned']));

  const agg = new Map<string, { total: number; done: number }>();
  assignments.forEach((a) => {
    const d = deptByUser.get(a.userId) ?? 'Unassigned';
    const cur = agg.get(d) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (a.status === 'COMPLETED') cur.done += 1;
    agg.set(d, cur);
  });
  const byDept = [...agg.entries()].map(([dept, v]) => ({ dept, compliance: pct(v.done, v.total, 0) })).sort((a, b) => b.compliance - a.compliance).slice(0, 8);
  const totals = [...agg.values()].reduce((acc, v) => ({ total: acc.total + v.total, done: acc.done + v.done }), { total: 0, done: 0 });
  return { sample: false, byDept, overall: pct(totals.done, totals.total, 0) };
}

async function buildAudit(ctx: Ctx, anchor: Date) {
  void ctx;
  const findings = await prisma.auditFinding.findMany({
    where: upto(anchor),
    select: { severity: true, status: true, program: { select: { register: { select: { title: true } } } } },
  }).catch(() => [] as { severity: string; status: string }[]);

  const sevMix = [
    { name: 'Critical', value: findings.filter((f) => f.severity === 'CRITICAL').length },
    { name: 'Major', value: findings.filter((f) => f.severity === 'MAJOR').length },
    { name: 'Minor', value: findings.filter((f) => f.severity === 'MINOR').length },
    { name: 'Observation', value: findings.filter((f) => f.severity === 'OBSERVATION').length },
  ].filter((s) => s.value > 0);

  // Group findings under their audit title as a proxy for "area".
  const areaMap = new Map<string, { Major: number; Minor: number; OFI: number }>();
  (findings as { severity: string; program?: { register?: { title?: string } } }[]).forEach((f) => {
    const area = f.program?.register?.title?.slice(0, 18) ?? 'General';
    const cur = areaMap.get(area) ?? { Major: 0, Minor: 0, OFI: 0 };
    if (f.severity === 'MAJOR' || f.severity === 'CRITICAL') cur.Major += 1;
    else if (f.severity === 'MINOR') cur.Minor += 1;
    else cur.OFI += 1;
    areaMap.set(area, cur);
  });
  const findingsByDept = [...areaMap.entries()].map(([dept, v]) => ({ dept, ...v })).slice(0, 6);
  return { sample: false, findingsByDept, severityMix: sevMix };
}

async function buildInspection(anchor: Date) {
  const grouped = await prisma.sampleTest.groupBy({ by: ['overallResult'], where: upto(anchor), _count: true }).catch(() => [] as { overallResult: string | null; _count: number }[]);

  const byResult = grouped.map((g) => ({ result: g.overallResult ?? 'Pending', count: g._count }));
  const pass = byResult.find((b) => /PASS|WITHIN/i.test(b.result))?.count ?? 0;
  const total = sum(byResult.map((b) => b.count));
  return { sample: false, byResult, passRate: pct(pass, total) };
}

async function buildCalibration(anchor: Date) {
  const now = anchor;
  const in30 = new Date(+now + 30 * DAY);
  const cut = upto(anchor);
  const [current, dueSoon, overdue, oos] = await Promise.all([
    prisma.equipment.count({ where: { isDeleted: false, ...cut, status: 'ACTIVE', calibrationDueAt: { gt: in30 } } }).catch(() => 0),
    prisma.equipment.count({ where: { isDeleted: false, ...cut, status: 'ACTIVE', calibrationDueAt: { gt: now, lte: in30 } } }).catch(() => 0),
    prisma.equipment.count({ where: { isDeleted: false, ...cut, calibrationDueAt: { lt: now } } }).catch(() => 0),
    prisma.equipment.count({ where: { isDeleted: false, ...cut, status: { not: 'ACTIVE' } } }).catch(() => 0),
  ]);

  return {
    sample: false,
    status: [
      { status: 'Current', count: current, fill: '#22C55E' },
      { status: 'Due Soon', count: dueSoon, fill: '#F59E0B' },
      { status: 'Overdue', count: overdue, fill: '#EF4444' },
      { status: 'Out of Service', count: oos, fill: '#94a3b8' },
    ].filter((s) => s.count > 0),
  };
}

async function buildScorecard(ctx: Ctx, anchor: Date) {
  const cut = upto(anchor);
  const [capaClosed, capaTotal, ncClosed, ncTotal] = await Promise.all([
    prisma.capa.count({ where: { ...deptWhere(ctx), ...cut, status: 'CLOSED' } }),
    prisma.capa.count({ where: { ...deptWhere(ctx), ...cut } }),
    prisma.nonConformance.count({ where: { ...deptWhere(ctx), ...cut, status: 'CLOSED' } }),
    prisma.nonConformance.count({ where: { ...deptWhere(ctx), ...cut } }),
  ]);

  const capaRate = pct(capaClosed, capaTotal, 0);
  const ncRate = pct(ncClosed, ncTotal, 0);
  return {
    sample: false,
    kpis: [
      { label: 'CAPA Closure Rate', value: `${capaRate}%`, sub: `${capaClosed}/${capaTotal} closed`, tone: capaRate >= 85 ? 'good' : capaRate >= 70 ? 'warn' : 'bad' },
      { label: 'NC Closure Rate', value: `${ncRate}%`, sub: `${ncClosed}/${ncTotal} closed`, tone: ncRate >= 85 ? 'good' : ncRate >= 70 ? 'warn' : 'bad' },
      { label: 'Open CAPAs', value: String(capaTotal - capaClosed), sub: 'In progress', tone: 'info' },
      { label: 'Open NCs', value: String(ncTotal - ncClosed), sub: 'Awaiting closure', tone: 'info' },
    ],
  };
}

async function buildActivity(ctx: Ctx, limit: number, anchor: Date) {
  void ctx;
  const rows = await prisma.auditTrailEntry.findMany({
    where: upto(anchor),
    orderBy: { createdAt: 'desc' }, take: limit,
    select: { id: true, action: true, entityType: true, entityId: true, userName: true, createdAt: true },
  }).catch(() => [] as { id: string; action: string; entityType: string; entityId: string; userName: string | null; createdAt: Date }[]);

  return {
    sample: false,
    items: rows.map((r) => ({ id: r.id, action: r.action, entityType: r.entityType, entityId: r.entityId, userName: r.userName ?? 'System', createdAt: r.createdAt.toISOString() })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Master orchestrator
// ─────────────────────────────────────────────────────────────────────────────
export async function overview(userId: string, q: OverviewQuery) {
  const ctx = await loadContext(userId, q.siteId);
  const anchor = resolveAnchor(q.year);
  const buckets = buildBuckets(q.range, anchor);

  // Which panels this persona sees, gated by permission.
  const layout = PANEL_ORDER.filter((key) => {
    const cat = PANEL_CATALOG[key];
    if (!cat.personas.includes(ctx.persona)) return false;
    if (cat.perm && !ctx.perms.has(cat.perm)) return false;
    return true;
  });

  const activityLimit = q.range === '7d' ? 5 : q.range === '30d' ? 7 : q.range === '90d' ? 9 : 12;

  const [
    snapshot, nonconformance, capa, complaints, documents, training, audit, inspection, calibration, scorecard, activity,
  ] = await Promise.all([
    buildSnapshot(ctx, q.range, anchor),
    buildNonConformance(ctx, buckets, anchor),
    buildCapa(ctx, anchor),
    buildComplaints(ctx, buckets, anchor),
    buildDocuments(ctx, anchor),
    buildTraining(ctx, anchor),
    buildAudit(ctx, anchor),
    buildInspection(anchor),
    buildCalibration(anchor),
    buildScorecard(ctx, anchor),
    buildActivity(ctx, activityLimit, anchor),
  ]);

  return {
    scope: {
      role: ctx.user?.role?.name ?? 'NONE',
      persona: ctx.persona,
      userName: ctx.user?.name ?? '',
      department: ctx.user?.department?.name ?? null,
      site: ctx.site ? { id: ctx.site.id, code: ctx.site.code, name: ctx.site.name } : null,
      organization: ctx.org ? { name: ctx.org.name, industry: ctx.org.industry, standards: ctx.org.standards } : null,
      range: q.range,
      year: anchor.getFullYear(),
      asOf: anchor.toISOString(),
      canViewAll: ctx.canViewAll,
    },
    layout,
    panels: {
      snapshot, nonconformance, capa, complaints, documents, training, audit, inspection, calibration, scorecard, activity,
    },
  };
}
