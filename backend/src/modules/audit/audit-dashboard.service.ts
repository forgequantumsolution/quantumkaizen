import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

// Turn a groupBy result into a { KEY: count } map so the FE doesn't have to.
const tally = <T extends string>(
  rows: Array<{ _count: { _all: number } } & Record<string, unknown>>,
  key: string,
): Record<T, number> => {
  const out = {} as Record<T, number>;
  for (const r of rows) {
    const k = r[key];
    if (k == null) continue;
    out[k as T] = r._count._all;
  }
  return out;
};

export interface AuditDashboardFilters {
  financialYear?: string;
  plant?: string;
  auditType?: string;
  status?: string;
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Build the 6-month rolling window of { label, key } buckets ending this month.
const buildMonthBuckets = (now: Date) => {
  const buckets: Array<{ label: string; y: number; m: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: MONTH_LABELS[d.getMonth()]!, y: d.getFullYear(), m: d.getMonth() });
  }
  return buckets;
};
const bucketIndex = (buckets: ReturnType<typeof buildMonthBuckets>, d: Date) =>
  buckets.findIndex((b) => b.y === d.getFullYear() && b.m === d.getMonth());

export const getAuditDashboard = async (filters: AuditDashboardFilters = {}) => {
  const now = new Date();

  // ── Register-scoped filter — the single source of truth every downstream
  //    aggregation cascades from (finding → program → register, etc.). ──────
  const registerWhere: Prisma.AuditRegisterWhereInput = {
    ...(filters.financialYear ? { financialYear: filters.financialYear } : {}),
    ...(filters.plant ? { plant: filters.plant } : {}),
    ...(filters.auditType ? { auditType: filters.auditType } : {}),
    ...(filters.status ? { status: filters.status as Prisma.EnumAuditStatusFilter } : {}),
  };
  const hasFilter = Object.keys(registerWhere).length > 0;

  // Downstream relation filters — only applied when a filter is active so the
  // unfiltered dashboard still counts standalone CAPAs / NCs / actions.
  const findingWhere: Prisma.AuditFindingWhereInput = hasFilter
    ? { program: { register: registerWhere } } : {};
  const ncWhere: Prisma.NonConformanceWhereInput = hasFilter
    ? { finding: { program: { register: registerWhere } } } : {};
  const capaWhere: Prisma.CapaWhereInput = hasFilter
    ? { nonConformance: { finding: { program: { register: registerWhere } } } } : {};
  const actionWhere: Prisma.ActionItemWhereInput = hasFilter
    ? {
        OR: [
          { finding: { program: { register: registerWhere } } },
          { nonConformance: { finding: { program: { register: registerWhere } } } },
          { capa: { nonConformance: { finding: { program: { register: registerWhere } } } } },
        ],
      }
    : {};
  const programWhere: Prisma.AuditProgramWhereInput = hasFilter ? { register: registerWhere } : {};

  const and = <T>(base: T, extra: Record<string, unknown>): T =>
    (hasFilter ? ({ AND: [base, extra] } as unknown as T) : (extra as unknown as T));

  const [
    registerByStatus,
    programByStatus,
    findingBySeverity,
    findingByStatus,
    ncByStatus,
    capaByStatus,
    capaByType,
    actionByStatus,
    ncByDepartment,
    capaOverdue,
    actionOverdue,
    ncOverdue,
    upcomingAudits,
    recentFindings,
    trendRegisters,
    trendFindings,
    departments,
    allRegisters,
  ] = await Promise.all([
    prisma.auditRegister.groupBy({ by: ['status'], where: registerWhere, _count: { _all: true } }),
    prisma.auditProgram.groupBy({ by: ['status'], where: programWhere, _count: { _all: true } }),
    prisma.auditFinding.groupBy({ by: ['severity'], where: findingWhere, _count: { _all: true } }),
    prisma.auditFinding.groupBy({ by: ['status'], where: findingWhere, _count: { _all: true } }),
    prisma.nonConformance.groupBy({ by: ['status'], where: ncWhere, _count: { _all: true } }),
    prisma.capa.groupBy({ by: ['status'], where: capaWhere, _count: { _all: true } }),
    prisma.capa.groupBy({ by: ['type'], where: capaWhere, _count: { _all: true } }),
    prisma.actionItem.groupBy({ by: ['status'], where: actionWhere, _count: { _all: true } }),
    prisma.nonConformance.groupBy({ by: ['departmentId'], where: ncWhere, _count: { _all: true } }),
    prisma.capa.count({
      where: and(capaWhere, { dueDate: { lt: now }, status: { notIn: ['CLOSED', 'CANCELLED'] } }),
    }),
    prisma.actionItem.count({
      where: and(actionWhere, { dueDate: { lt: now }, status: { notIn: ['DONE', 'VERIFIED', 'CANCELLED'] } }),
    }),
    prisma.nonConformance.count({
      where: and(ncWhere, { dueDate: { lt: now }, status: { notIn: ['CLOSED', 'CANCELLED'] } }),
    }),
    prisma.auditRegister.findMany({
      where: and(registerWhere, { plannedDate: { gte: now }, status: { in: ['APPROVED', 'IN_PROGRESS'] } }),
      select: { id: true, registerNumber: true, title: true, plannedDate: true, status: true },
      orderBy: { plannedDate: 'asc' },
      take: 8,
    }),
    prisma.auditFinding.findMany({
      where: findingWhere,
      select: {
        id: true,
        findingNumber: true,
        severity: true,
        status: true,
        description: true,
        createdAt: true,
        program: { select: { id: true, register: { select: { title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    // Trend source — registers within the window (planned + completion signal).
    prisma.auditRegister.findMany({
      where: registerWhere,
      select: { plannedDate: true, status: true, updatedAt: true },
    }),
    // Trend source — findings within the window.
    prisma.auditFinding.findMany({
      where: findingWhere,
      select: { createdAt: true },
    }),
    prisma.department.findMany({ select: { id: true, name: true } }),
    // Unfiltered — powers the filter dropdowns so they always list every option.
    prisma.auditRegister.findMany({
      select: { financialYear: true, plant: true, auditType: true, status: true },
    }),
  ]);

  const registers = tally(registerByStatus, 'status');
  const programs = tally(programByStatus, 'status');
  const ncs = tally(ncByStatus, 'status');
  const capas = tally(capaByStatus, 'status');
  const actions = tally(actionByStatus, 'status');

  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
  const totalRegisters = sum(registers);
  const completedRegisters = (registers.COMPLETED ?? 0) + (registers.CLOSED ?? 0);

  // ── Monthly trends (last 6 months) ──────────────────────────────────────
  const regBuckets = buildMonthBuckets(now);
  const monthly = regBuckets.map((b) => ({ month: b.label, planned: 0, completed: 0 }));
  for (const r of trendRegisters) {
    const pi = bucketIndex(regBuckets, new Date(r.plannedDate));
    if (pi >= 0) monthly[pi]!.planned++;
    if (r.status === 'COMPLETED' || r.status === 'CLOSED') {
      const ci = bucketIndex(regBuckets, new Date(r.updatedAt));
      if (ci >= 0) monthly[ci]!.completed++;
    }
  }
  const findingsTrend = regBuckets.map((b) => ({ month: b.label, findings: 0 }));
  for (const f of trendFindings) {
    const fi = bucketIndex(regBuckets, new Date(f.createdAt));
    if (fi >= 0) findingsTrend[fi]!.findings++;
  }

  // ── NCs by department (named) ───────────────────────────────────────────
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const ncsByDepartment = ncByDepartment
    .map((r) => ({
      name: r.departmentId ? deptName.get(r.departmentId) ?? 'Unknown' : 'Unassigned',
      value: r._count._all,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── Dynamic filter options (from the full register set) ─────────────────
  const distinct = (vals: Array<string | null>) =>
    Array.from(new Set(vals.filter((v): v is string => !!v && v.trim() !== ''))).sort();
  const filterOptions = {
    financial_years: distinct(allRegisters.map((r) => r.financialYear)),
    plants: distinct(allRegisters.map((r) => r.plant)),
    audit_types: distinct(allRegisters.map((r) => r.auditType)),
    statuses: distinct(allRegisters.map((r) => r.status)),
  };

  return {
    kpis: {
      total_audits: totalRegisters,
      completed_audits: completedRegisters,
      completion_rate:
        totalRegisters > 0 ? Math.round((completedRegisters / totalRegisters) * 100) : 0,
      in_progress_audits: programs.IN_PROGRESS ?? 0,
      open_findings:
        (findingByStatus.find((r) => r.status === 'OPEN')?._count._all ?? 0) +
        (findingByStatus.find((r) => r.status === 'IN_REVIEW')?._count._all ?? 0),
      open_ncs: sum(ncs) - (ncs.CLOSED ?? 0) - (ncs.CANCELLED ?? 0),
      open_capas: sum(capas) - (capas.CLOSED ?? 0) - (capas.CANCELLED ?? 0),
      overdue_capas: capaOverdue,
      open_actions: sum(actions) - (actions.DONE ?? 0) - (actions.VERIFIED ?? 0) - (actions.CANCELLED ?? 0),
      overdue_actions: actionOverdue,
      overdue_ncs: ncOverdue,
    },
    registers_by_status: registers,
    programs_by_status: programs,
    findings_by_severity: tally(findingBySeverity, 'severity'),
    findings_by_status: tally(findingByStatus, 'status'),
    ncs_by_status: ncs,
    capas_by_status: capas,
    capas_by_type: tally(capaByType, 'type'),
    actions_by_status: actions,
    ncs_by_department: ncsByDepartment,
    monthly_trend: monthly,
    findings_trend: findingsTrend,
    filter_options: filterOptions,
    upcoming_audits: upcomingAudits.map((r) => ({
      id: r.id,
      register_number: r.registerNumber,
      title: r.title,
      planned_date: r.plannedDate,
      status: r.status,
    })),
    recent_findings: recentFindings.map((f) => ({
      id: f.id,
      finding_number: f.findingNumber,
      severity: f.severity,
      status: f.status,
      description: f.description,
      audit_title: f.program?.register?.title ?? null,
      program_id: f.program?.id ?? null,
      created_at: f.createdAt,
    })),
  };
};
