import prisma from '../lib/prisma.js';
import logger from '../config/logger.js';

// ─── Types ───────────────────────────────────────────────────────────

interface ManagementReviewPack {
  generatedAt: string;
  tenantId: string;
  tenantName: string;
  period: { from: string; to: string };
  summary: {
    totalDocuments: number;
    documentsByStatus: Record<string, number>;
    totalNCs: number;
    ncsBySeverity: Record<string, number>;
    ncsByStatus: Record<string, number>;
    totalCAPAs: number;
    capasByStatus: Record<string, number>;
    capasBySource: Record<string, number>;
    riskRegister: {
      total: number;
      byLevel: Record<string, number>;
    };
    training: {
      totalPrograms: number;
      totalAssignments: number;
      completionRate: number;
      overdueCount: number;
    };
  };
  trends: {
    ncOpenVsClosed: { open: number; closed: number };
    capaEffectivenessRate: number;
    averageNCClosureDays: number | null;
  };
}

interface AuditReportData {
  generatedAt: string;
  auditTrail: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    userName: string;
    userRole: string;
    timestampUtc: Date;
    changedFields: string[];
  }>;
  signatures: Array<{
    id: string;
    userName: string;
    meaning: string;
    entityType: string;
    entityId: string;
    timestampUtc: Date;
    signatureHash: string;
  }>;
  totalEntries: number;
}

interface CAPAReportData {
  generatedAt: string;
  capa: {
    capaNumber: string;
    title: string;
    description: string;
    source: string;
    severity: string;
    status: string;
    department: string | null;
    site: string | null;
    ownerName: string;
    discoveryDate: Date | null;
    dueDate: Date | null;
    closedAt: Date | null;
    rootCauseAnalysis: unknown;
    effectivenessCriteria: string | null;
    effectivenessResult: string | null;
  };
  actions: Array<{
    id: string;
    type: string;
    description: string;
    ownerId: string;
    dueDate: Date | null;
    completionDate: Date | null;
    verificationStatus: string | null;
  }>;
  linkedNCs: Array<{
    ncNumber: string;
    title: string;
    severity: string;
    status: string;
  }>;
  timeline: Array<{
    action: string;
    userName: string;
    timestamp: Date;
    details: string[];
  }>;
}

// ─── Management Review Pack ──────────────────────────────────────────

export async function generateManagementReviewPack(
  tenantId: string,
  periodMonths: number = 6
): Promise<ManagementReviewPack> {
  logger.info('Generating management review pack', { tenantId, periodMonths });

  const now = new Date();
  const periodFrom = new Date(now);
  periodFrom.setMonth(periodFrom.getMonth() - periodMonths);

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  // Aggregate data from all modules in parallel
  const [
    documents,
    ncs,
    capas,
    risks,
    trainingPrograms,
    trainingAssignments,
  ] = await Promise.all([
    prisma.document.findMany({
      where: { tenantId },
      select: { status: true, createdAt: true },
    }),
    prisma.nonConformance.findMany({
      where: { tenantId, createdAt: { gte: periodFrom } },
      select: { severity: true, status: true, createdAt: true, closedAt: true },
    }),
    prisma.cAPA.findMany({
      where: { tenantId, createdAt: { gte: periodFrom } },
      select: { status: true, source: true, effectivenessResult: true, closedAt: true },
    }),
    prisma.riskRegister.findMany({
      where: { tenantId },
      select: { riskLevel: true, status: true },
    }),
    prisma.trainingProgram.count({ where: { tenantId, isActive: true } }),
    prisma.trainingAssignment.findMany({
      where: { program: { tenantId } },
      select: { status: true },
    }),
  ]);

  // Document stats
  const documentsByStatus: Record<string, number> = {};
  documents.forEach((d) => {
    documentsByStatus[d.status] = (documentsByStatus[d.status] || 0) + 1;
  });

  // NC stats
  const ncsBySeverity: Record<string, number> = {};
  const ncsByStatus: Record<string, number> = {};
  let totalClosureDays = 0;
  let closedCount = 0;
  ncs.forEach((nc) => {
    ncsBySeverity[nc.severity] = (ncsBySeverity[nc.severity] || 0) + 1;
    ncsByStatus[nc.status] = (ncsByStatus[nc.status] || 0) + 1;
    if (nc.closedAt) {
      totalClosureDays += (nc.closedAt.getTime() - nc.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      closedCount++;
    }
  });

  // CAPA stats
  const capasByStatus: Record<string, number> = {};
  const capasBySource: Record<string, number> = {};
  let effectiveCapas = 0;
  let verifiedCapas = 0;
  capas.forEach((c) => {
    capasByStatus[c.status] = (capasByStatus[c.status] || 0) + 1;
    capasBySource[c.source] = (capasBySource[c.source] || 0) + 1;
    if (c.effectivenessResult) {
      verifiedCapas++;
      if (c.effectivenessResult === 'EFFECTIVE') effectiveCapas++;
    }
  });

  // Risk stats
  const riskByLevel: Record<string, number> = {};
  const activeRisks = risks.filter((r) => r.status === 'ACTIVE');
  activeRisks.forEach((r) => {
    riskByLevel[r.riskLevel] = (riskByLevel[r.riskLevel] || 0) + 1;
  });

  // Training stats
  const completedAssignments = trainingAssignments.filter((a) => a.status === 'COMPLETED').length;
  const overdueAssignments = trainingAssignments.filter((a) => a.status === 'OVERDUE').length;

  const openNCs = ncs.filter((nc) => nc.status !== 'CLOSED').length;
  const closedNCs = ncs.filter((nc) => nc.status === 'CLOSED').length;

  return {
    generatedAt: now.toISOString(),
    tenantId,
    tenantName: tenant.name,
    period: {
      from: periodFrom.toISOString(),
      to: now.toISOString(),
    },
    summary: {
      totalDocuments: documents.length,
      documentsByStatus,
      totalNCs: ncs.length,
      ncsBySeverity,
      ncsByStatus,
      totalCAPAs: capas.length,
      capasByStatus,
      capasBySource,
      riskRegister: {
        total: activeRisks.length,
        byLevel: riskByLevel,
      },
      training: {
        totalPrograms: trainingPrograms,
        totalAssignments: trainingAssignments.length,
        completionRate:
          trainingAssignments.length > 0
            ? Math.round((completedAssignments / trainingAssignments.length) * 100)
            : 0,
        overdueCount: overdueAssignments,
      },
    },
    trends: {
      ncOpenVsClosed: { open: openNCs, closed: closedNCs },
      capaEffectivenessRate:
        verifiedCapas > 0 ? Math.round((effectiveCapas / verifiedCapas) * 100) : 0,
      averageNCClosureDays:
        closedCount > 0 ? Math.round((totalClosureDays / closedCount) * 10) / 10 : null,
    },
  };
}

// ─── Audit Report ────────────────────────────────────────────────────

export async function generateAuditReport(
  tenantId: string,
  entityType?: string,
  entityId?: string,
  fromDate?: Date,
  toDate?: Date
): Promise<AuditReportData> {
  logger.info('Generating audit report', { tenantId, entityType, entityId });

  const where: Record<string, unknown> = { tenantId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (fromDate || toDate) {
    where.timestampUtc = {};
    if (fromDate) (where.timestampUtc as Record<string, Date>).gte = fromDate;
    if (toDate) (where.timestampUtc as Record<string, Date>).lte = toDate;
  }

  const [auditTrail, signatures] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestampUtc: 'desc' },
      take: 5000,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        userName: true,
        userRole: true,
        timestampUtc: true,
        changedFields: true,
      },
    }),
    prisma.electronicSignature.findMany({
      where: {
        tenantId,
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { timestampUtc: 'desc' },
      select: {
        id: true,
        userName: true,
        meaning: true,
        entityType: true,
        entityId: true,
        timestampUtc: true,
        signatureHash: true,
      },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    auditTrail,
    signatures,
    totalEntries: auditTrail.length,
  };
}

// ─── CAPA Report ─────────────────────────────────────────────────────

export async function generateCAPAReport(capaId: string): Promise<CAPAReportData> {
  logger.info('Generating CAPA report', { capaId });

  const capa = await prisma.cAPA.findUniqueOrThrow({
    where: { id: capaId },
    include: {
      owner: { select: { name: true } },
      actions: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          description: true,
          ownerId: true,
          dueDate: true,
          completionDate: true,
          verificationStatus: true,
        },
      },
      nonConformances: {
        select: {
          ncNumber: true,
          title: true,
          severity: true,
          status: true,
        },
      },
    },
  });

  // Build timeline from audit log
  const auditEntries = await prisma.auditLog.findMany({
    where: {
      tenantId: capa.tenantId,
      entityType: 'CAPA',
      entityId: capaId,
    },
    orderBy: { timestampUtc: 'asc' },
    select: {
      action: true,
      userName: true,
      timestampUtc: true,
      changedFields: true,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    capa: {
      capaNumber: capa.capaNumber,
      title: capa.title,
      description: capa.description,
      source: capa.source,
      severity: capa.severity,
      status: capa.status,
      department: capa.department,
      site: capa.site,
      ownerName: capa.owner.name,
      discoveryDate: capa.discoveryDate,
      dueDate: capa.dueDate,
      closedAt: capa.closedAt,
      rootCauseAnalysis: capa.rootCauseAnalysis,
      effectivenessCriteria: capa.effectivenessCriteria,
      effectivenessResult: capa.effectivenessResult,
    },
    actions: capa.actions,
    linkedNCs: capa.nonConformances,
    timeline: auditEntries.map((entry) => ({
      action: entry.action,
      userName: entry.userName,
      timestamp: entry.timestampUtc,
      details: entry.changedFields,
    })),
  };
}
