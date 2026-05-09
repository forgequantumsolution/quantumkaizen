import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * When a ticket enters a fork stage, we record one ParallelBranchTracking
 * row per outgoing branch. branchPath is the list of stage canonicalIds
 * walked from the branch start until the join (best-effort).
 */
export const startBranches = async (
  tx: Tx,
  params: {
    ticketId: string;
    forkStageId: string;
    joinStageId: string | null;
    branchStartStageIds: string[];
  }
): Promise<void> => {
  for (const startId of params.branchStartStageIds) {
    const path = await walkBranchPath(tx, startId, params.joinStageId);
    await tx.parallelBranchTracking.create({
      data: {
        ticketId: params.ticketId,
        forkStageId: params.forkStageId,
        joinStageId: params.joinStageId,
        branchPath: path as Prisma.InputJsonValue,
        status: 'ACTIVE',
      },
    });
  }
};

/**
 * Walk forward from a branch-start stage until reaching the join stage
 * (or no outgoing transitions, or 50 steps to avoid pathological loops).
 * Returns a list of stage IDs (DB ids — caller can map to canonicalIds
 * if needed).
 */
const walkBranchPath = async (
  tx: Tx,
  startId: string,
  joinStageId: string | null
): Promise<string[]> => {
  const path: string[] = [startId];
  let cursor: string | null = startId;
  for (let i = 0; i < 50; i++) {
    if (!cursor || cursor === joinStageId) break;
    const next: { toStageId: string } | null = await tx.workflowTransition.findFirst({
      where: { fromStageId: cursor, isDeleted: false },
      orderBy: { branchOrder: 'asc' },
      select: { toStageId: true },
    });
    if (!next) break;
    if (next.toStageId === joinStageId) break;
    path.push(next.toStageId);
    cursor = next.toStageId;
  }
  return path;
};

/**
 * Mark the active branch containing `currentStageId` as COMPLETED.
 * Returns the fork stage id if all sibling branches are complete (per joinType),
 * else null.
 */
export const markBranchCompleted = async (
  tx: Tx,
  params: {
    ticketId: string;
    arrivingAtJoinStageId: string;
  }
): Promise<{ allComplete: boolean; forkStageId: string | null }> => {
  // Find branches converging at this join
  const active = await tx.parallelBranchTracking.findMany({
    where: {
      ticketId: params.ticketId,
      joinStageId: params.arrivingAtJoinStageId,
      status: 'ACTIVE',
    },
    select: { id: true, forkStageId: true },
  });

  if (active.length === 0) {
    return { allComplete: false, forkStageId: null };
  }

  // Mark one as completed (the most recent ACTIVE branch — caller is the
  // ticket arriving from one of the upstream stages). Best-effort: in a
  // real engine we'd track which branch is completing more precisely.
  const branch = active[0]!;
  await tx.parallelBranchTracking.update({
    where: { id: branch.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  // Check joinType on the join stage
  const joinStage = await tx.workflowStage.findUnique({
    where: { id: params.arrivingAtJoinStageId },
    select: { joinType: true },
  });
  const joinType = joinStage?.joinType ?? 'AND';

  const remaining = await tx.parallelBranchTracking.count({
    where: {
      ticketId: params.ticketId,
      joinStageId: params.arrivingAtJoinStageId,
      status: 'ACTIVE',
    },
  });

  let allComplete = false;
  if (joinType === 'AND') {
    allComplete = remaining === 0;
  } else if (joinType === 'OR') {
    // First branch through completes the join; cancel siblings.
    if (remaining > 0) {
      await tx.parallelBranchTracking.updateMany({
        where: {
          ticketId: params.ticketId,
          joinStageId: params.arrivingAtJoinStageId,
          status: 'ACTIVE',
        },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
    }
    allComplete = true;
  }

  return { allComplete, forkStageId: branch.forkStageId };
};
