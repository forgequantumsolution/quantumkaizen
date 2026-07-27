/**
 * Sidebar notification counts (FQS-QK-UIUX-003 §4, U-01). Returns open/actionable
 * item counts per module so the sidebar can badge modules that need attention
 * without the user opening each one. Read-only aggregation — no schema changes.
 */
import { prisma } from '../../lib/prisma';
import { CapaStatus } from '@prisma/client';

export interface NavCounts {
  /** open ticket count keyed by workflow-type id (drives dynamic module badges) */
  workflowTypes: Record<string, number>;
  /** open OOS/OOT investigations (not CLOSED) */
  oos: number;
  /** open CAPA records (not CLOSED/CANCELLED) */
  capa: number;
  /**
   * Risks needing attention: an overdue periodic review, or an unaccepted risk
   * sitting at an UNACCEPTABLE level. Deliberately not "all open risks" — a
   * badge showing the size of the register is noise, whereas both of these are
   * things somebody has to act on.
   */
  risk: number;
}

export async function navCounts(): Promise<NavCounts> {
  // Risk level ids are plain scalars on Risk (the module keeps FKs only for
  // register/framework/category), so the unacceptable bands are resolved first
  // rather than joined through.
  const unacceptableLevelIds = (
    await prisma.riskLevelDef.findMany({ where: { acceptance: 'UNACCEPTABLE' }, select: { id: true } })
  ).map((l) => l.id);

  const [oos, capa, riskCount, flowGroups] = await Promise.all([
    prisma.oosInvestigation.count({ where: { status: { not: 'CLOSED' } } }),
    prisma.capa.count({ where: { status: { notIn: [CapaStatus.CLOSED, CapaStatus.CANCELLED] } } }),
    // One query, not two: a risk that is both overdue and unaccepted must count
    // once, or the badge overstates the work.
    prisma.risk.count({
      where: {
        status: { not: 'CLOSED' },
        OR: [
          { nextReviewAt: { lt: new Date() } },
          ...(unacceptableLevelIds.length
            ? [{ acceptedAt: null, residualLevelId: { in: unacceptableLevelIds } }]
            : []),
        ],
      },
    }),
    // Open work lives on TicketFlow (isCompleted = false); the workflow type is
    // two hops away (TicketFlow → Workflow.typeId), so group by workflow then map.
    prisma.ticketFlow.groupBy({
      by: ['workflowId'],
      where: { isCompleted: false, ticket: { isDeleted: false } },
      _count: { _all: true },
    }),
  ]);

  const workflowIds = flowGroups.map((g) => g.workflowId).filter(Boolean) as string[];
  const workflows = workflowIds.length
    ? await prisma.workflow.findMany({
        where: { id: { in: workflowIds } },
        select: { id: true, typeId: true },
      })
    : [];
  const typeByWorkflow = new Map(workflows.map((w) => [w.id, w.typeId]));

  const workflowTypes: Record<string, number> = {};
  for (const g of flowGroups) {
    const typeId = g.workflowId ? typeByWorkflow.get(g.workflowId) : null;
    if (typeId) workflowTypes[typeId] = (workflowTypes[typeId] ?? 0) + g._count._all;
  }

  return { workflowTypes, oos, capa, risk: riskCount };
}
