import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

interface StageRef {
  id: string;
  name: string;
  workflowId: string;
}

/**
 * Open a new TicketStageTracking row for a stage the ticket just entered.
 * Caller is responsible for closing any prior active row first.
 */
export const openStageTracking = async (
  tx: Tx,
  ticketId: string,
  stage: StageRef
): Promise<{ id: string }> => {
  const row = await tx.ticketStageTracking.create({
    data: {
      ticketId,
      stageId: stage.id,
      stageName: stage.name,
      stageWorkflowId: stage.workflowId,
      isActive: true,
    },
    select: { id: true },
  });
  return row;
};

/**
 * Close the active tracking row(s) for a ticket on a specific stage.
 * Returns the count of rows closed.
 */
export const closeStageTracking = async (
  tx: Tx,
  params: {
    ticketId: string;
    stageId: string;
    performedById: string | null;
    postActionId?: string | null;
    remarks?: string | null;
    returnedFromStageId?: string | null;
  }
): Promise<number> => {
  const now = new Date();
  // Need to compute durationSec per-row since each row may have a different enteredAt.
  const active = await tx.ticketStageTracking.findMany({
    where: {
      ticketId: params.ticketId,
      stageId: params.stageId,
      isActive: true,
    },
    select: { id: true, enteredAt: true },
  });
  for (const row of active) {
    const durationSec = Math.max(
      0,
      Math.floor((now.getTime() - row.enteredAt.getTime()) / 1000)
    );
    await tx.ticketStageTracking.update({
      where: { id: row.id },
      data: {
        exitedAt: now,
        durationSec,
        isActive: false,
        performedById: params.performedById,
        postActionId: params.postActionId ?? null,
        remarks: params.remarks ?? null,
        returnedFromStageId: params.returnedFromStageId ?? null,
      },
    });
  }
  return active.length;
};

/**
 * Set the on-hold flag on all active tracking rows for a ticket.
 */
export const setHoldOnActiveTracking = async (
  tx: Tx,
  ticketId: string,
  isOnHold: boolean,
  reason?: string | null
): Promise<number> => {
  const result = await tx.ticketStageTracking.updateMany({
    where: { ticketId, isActive: true },
    data: {
      isOnHold,
      holdReason: isOnHold ? reason ?? null : null,
    },
  });
  return result.count;
};
