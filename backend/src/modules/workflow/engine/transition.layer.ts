import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * The ONLY place that mutates TicketFlow.currentStages and isCompleted.
 *
 * Atomic update: disconnect a set of stage ids and connect another set,
 * then check terminal state.
 */
export const advanceFlow = async (
  tx: Tx,
  flowId: string,
  params: {
    disconnectStageIds: string[];
    connectStageIds: string[];
  }
): Promise<{ isCompleted: boolean }> => {
  await tx.ticketFlow.update({
    where: { id: flowId },
    data: {
      currentStages: {
        disconnect: params.disconnectStageIds.map((id) => ({ id })),
        connect: params.connectStageIds.map((id) => ({ id })),
      },
      statusUpdatedAt: new Date(),
    },
  });

  // Recheck terminal state
  const flow = await tx.ticketFlow.findUnique({
    where: { id: flowId },
    select: {
      currentStages: { select: { id: true } },
    },
  });
  const isCompleted = (flow?.currentStages.length ?? 0) === 0;

  if (isCompleted) {
    await tx.ticketFlow.update({
      where: { id: flowId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });
  }
  return { isCompleted };
};
