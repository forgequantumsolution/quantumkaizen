import { prisma } from '../../lib/prisma';

// Turn a groupBy result into a { KEY: count } map so the FE doesn't have to.
const tally = <T extends string>(
  rows: Array<{ _count: { _all: number } } & Record<string, unknown>>,
  key: string,
): Record<T, number> => {
  const out = {} as Record<T, number>;
  for (const r of rows) out[r[key] as T] = r._count._all;
  return out;
};

export const getAuditDashboard = async (financialYear?: string) => {
  const registerWhere = financialYear ? { financialYear } : {};
  const now = new Date();

  const [
    registerByStatus,
    programByStatus,
    findingBySeverity,
    findingByStatus,
    ncByStatus,
    capaByStatus,
    actionByStatus,
    capaOverdue,
    actionOverdue,
    ncOverdue,
    upcomingAudits,
    recentFindings,
  ] = await Promise.all([
    prisma.auditRegister.groupBy({ by: ['status'], where: registerWhere, _count: { _all: true } }),
    prisma.auditProgram.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.auditFinding.groupBy({ by: ['severity'], _count: { _all: true } }),
    prisma.auditFinding.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.nonConformance.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.capa.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.actionItem.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.capa.count({
      where: { dueDate: { lt: now }, status: { notIn: ['CLOSED', 'CANCELLED'] } },
    }),
    prisma.actionItem.count({
      where: { dueDate: { lt: now }, status: { notIn: ['DONE', 'VERIFIED', 'CANCELLED'] } },
    }),
    prisma.nonConformance.count({
      where: { dueDate: { lt: now }, status: { notIn: ['CLOSED', 'CANCELLED'] } },
    }),
    prisma.auditRegister.findMany({
      where: { plannedDate: { gte: now }, status: { in: ['APPROVED', 'IN_PROGRESS'] } },
      select: { id: true, registerNumber: true, title: true, plannedDate: true, status: true },
      orderBy: { plannedDate: 'asc' },
      take: 8,
    }),
    prisma.auditFinding.findMany({
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
  ]);

  const registers = tally(registerByStatus, 'status');
  const programs = tally(programByStatus, 'status');
  const ncs = tally(ncByStatus, 'status');
  const capas = tally(capaByStatus, 'status');
  const actions = tally(actionByStatus, 'status');

  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
  const totalRegisters = sum(registers);
  const completedRegisters = (registers.COMPLETED ?? 0) + (registers.CLOSED ?? 0);

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
      open_ncs:
        sum(ncs) - (ncs.CLOSED ?? 0) - (ncs.CANCELLED ?? 0),
      open_capas: sum(capas) - (capas.CLOSED ?? 0) - (capas.CANCELLED ?? 0),
      overdue_capas: capaOverdue,
      open_actions: sum(actions) - (actions.DONE ?? 0) - (actions.VERIFIED ?? 0) - (actions.CANCELLED ?? 0),
      overdue_actions: actionOverdue,
      overdue_ncs: ncOverdue,
    },
    registers_by_status: registers,
    programs_by_status: programs,
    findings_by_severity: tally(findingBySeverity, 'severity'),
    ncs_by_status: ncs,
    capas_by_status: capas,
    actions_by_status: actions,
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
