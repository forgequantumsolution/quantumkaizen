import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';

// Assemble a full audit report payload: register + program + findings + the
// NC/CAPA remediation chain + signatures. Rendered to a printable page on the FE.
export const getAuditReport = async (registerId: string) => {
  const register = await prisma.auditRegister.findUnique({
    where: { id: registerId },
    include: {
      auditMaster: { select: { id: true, name: true, code: true } },
      isoStandard: { select: { id: true, name: true } },
      auditor: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      program: {
        include: {
          findings: {
            include: {
              isoSubClause: { select: { subClauseNumber: true, subClauseTitle: true } },
              nonConformance: {
                include: {
                  department: { select: { name: true } },
                  capa: {
                    select: {
                      id: true,
                      capaNumber: true,
                      status: true,
                      type: true,
                      rootCause: true,
                      correctiveAction: true,
                      preventiveAction: true,
                      owner: { select: { name: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
  if (!register) throw NotFound('Audit register not found');

  const findings = register.program?.findings ?? [];
  const sevCount = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  // Pull e-signatures for the register and its program (if any).
  const sigEntities = [registerId, register.program?.id].filter(Boolean) as string[];
  const signatures = await prisma.eSignature.findMany({
    where: { entityId: { in: sigEntities } },
    orderBy: { signedAt: 'asc' },
  });

  return {
    data: {
      generated_at: new Date(),
      register: {
        register_number: register.registerNumber,
        title: register.title,
        status: register.status,
        audit_type: register.auditType,
        plant: register.plant,
        planned_date: register.plannedDate,
        financial_year: register.financialYear,
        audit_method: register.auditMethod,
        iso_standard: register.isoStandard?.name ?? null,
        audit_master: register.auditMaster?.name ?? null,
        auditor: register.auditor?.name ?? null,
        approver: register.approver?.name ?? null,
        approved_by: register.approvedBy?.name ?? null,
        approved_at: register.approvedAt,
        created_by: register.createdBy?.name ?? null,
        description: register.description,
      },
      program: register.program
        ? {
            program_number: register.program.programNumber,
            status: register.program.status,
            started_at: register.program.startedAt,
            completed_at: register.program.completedAt,
            summary: register.program.summary,
            score: register.program.score,
          }
        : null,
      summary: {
        total_findings: findings.length,
        by_severity: sevCount,
      },
      findings: findings.map((f) => ({
        finding_number: f.findingNumber,
        severity: f.severity,
        status: f.status,
        clause_ref:
          f.clauseRef ??
          (f.isoSubClause ? `${f.isoSubClause.subClauseNumber} ${f.isoSubClause.subClauseTitle}` : null),
        description: f.description,
        recommendation: f.recommendation,
        non_conformance: f.nonConformance
          ? {
              nc_number: f.nonConformance.ncNumber,
              status: f.nonConformance.status,
              department: f.nonConformance.department?.name ?? null,
              capa: f.nonConformance.capa
                ? {
                    capa_number: f.nonConformance.capa.capaNumber,
                    status: f.nonConformance.capa.status,
                    type: f.nonConformance.capa.type,
                    root_cause: f.nonConformance.capa.rootCause,
                    corrective_action: f.nonConformance.capa.correctiveAction,
                    preventive_action: f.nonConformance.capa.preventiveAction,
                    owner: f.nonConformance.capa.owner?.name ?? null,
                  }
                : null,
            }
          : null,
      })),
      signatures: signatures.map((s) => ({
        meaning: s.meaning,
        user_name: s.userName,
        signed_at: s.signedAt,
      })),
    },
  };
};
