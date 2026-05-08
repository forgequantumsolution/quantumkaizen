import type { Prisma, StageType, SplitType } from '@prisma/client';
import { evaluateCondition } from './decision.layer';

type Tx = Prisma.TransactionClient;

interface NextStageInfo {
  stageId: string;
  branchOrder: number;
  branchName: string | null;
  sourcePort: string | null;
  targetPort: string | null;
  condition: string | null;
}

/**
 * Resolve the set of next stages from a current stage.
 * Applies fork split logic (AND/OR/XOR) — for non-fork stages there's
 * typically a single transition.
 */
export const resolveNextStages = async (
  tx: Tx,
  fromStage: { id: string; stageType: StageType; splitType: SplitType | null },
  ticketContext: { customFields?: Record<string, unknown> | null }
): Promise<NextStageInfo[]> => {
  const transitions = await tx.workflowTransition.findMany({
    where: { fromStageId: fromStage.id, isDeleted: false },
    orderBy: { branchOrder: 'asc' },
    select: {
      toStageId: true,
      branchOrder: true,
      branchName: true,
      sourcePort: true,
      targetPort: true,
      condition: true,
    },
  });

  const all = transitions.map<NextStageInfo>((t) => ({
    stageId: t.toStageId,
    branchOrder: t.branchOrder,
    branchName: t.branchName,
    sourcePort: t.sourcePort,
    targetPort: t.targetPort,
    condition: t.condition,
  }));

  if (fromStage.stageType !== 'FORK' && fromStage.stageType !== 'DECISION') {
    // Regular stage: at most one outgoing transition; if multiple exist,
    // pick the first by branchOrder (matches prod behavior).
    return all.slice(0, 1);
  }

  const splitType = fromStage.splitType ?? 'AND';
  if (splitType === 'AND') return all;
  if (splitType === 'OR') return all;
  // XOR: pick the first transition whose condition evaluates true; fall back
  // to the last unconditional one if none match.
  for (const t of all) {
    if (evaluateCondition(t.condition, { ticket: ticketContext })) {
      return [t];
    }
  }
  return all.length > 0 ? [all[all.length - 1]!] : [];
};

/**
 * Walk backward through TicketStageTracking to find the previous active
 * stage(s) on a ticket — used by REJECT and RETURN behaviors.
 */
export const getPreviousActiveStageId = async (
  tx: Tx,
  ticketId: string
): Promise<string | null> => {
  // Find the most recent closed tracking row that is NOT the currently
  // active stage. We pick the latest exitedAt of an inactive row.
  const previous = await tx.ticketStageTracking.findFirst({
    where: { ticketId, isActive: false, stageId: { not: null } },
    orderBy: { exitedAt: 'desc' },
    select: { stageId: true },
  });
  return previous?.stageId ?? null;
};
