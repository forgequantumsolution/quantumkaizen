import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import type { SaveLayoutBody } from './workflow.schema';

/**
 * POST /api/workflows/:id/save-layout
 *
 * Updates only `position` for stages matched by `canonicalId`. Skips entries
 * that don't resolve to an existing stage; returns the count of updated stages.
 *
 * Performance: positions are dispatched in parallel via Promise.all so the
 * total wall-clock cost is ~one round-trip regardless of node count, instead
 * of N sequential round-trips. Autosave fires every 1.5s on drag, so this
 * matters a lot on a remote DB.
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

  if (body.positions.length === 0) return { updated: 0 };

  const results = await Promise.all(
    body.positions.map((entry) =>
      prisma.workflowStage.updateMany({
        where: { workflowId, canonicalId: entry.canonicalId },
        data: { position: entry.position as Prisma.InputJsonValue },
      }),
    ),
  );
  const updated = results.reduce((sum, r) => sum + r.count, 0);
  return { updated };
};
