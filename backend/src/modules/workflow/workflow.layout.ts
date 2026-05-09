import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import type { SaveLayoutBody } from './workflow.schema';

/**
 * POST /api/workflows/:id/save-layout
 *
 * Updates only `position` for stages matched by `canonicalId`. Skips entries
 * that don't resolve to an existing stage; returns the count of updated stages.
 */
export const saveLayout = async (
  workflowId: string,
  body: SaveLayoutBody
): Promise<{ updated: number }> => {
  const wf = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, isDeleted: true },
  });
  if (!wf) throw NotFound(`Workflow ${workflowId} not found`);
  if (wf.isDeleted) throw BadRequest('Cannot update layout of a deleted workflow');

  let updated = 0;
  for (const entry of body.positions) {
    const result = await prisma.workflowStage.updateMany({
      where: { workflowId, canonicalId: entry.canonicalId },
      data: { position: entry.position as Prisma.InputJsonValue },
    });
    updated += result.count;
  }
  return { updated };
};
