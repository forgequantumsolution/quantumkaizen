import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import type { SaveLayoutBody } from './workflow.schema';

/**
 * POST /api/workflows/:id/save-layout
 *
 * Updates only `position` for stages matched by `canonicalId`. Skips entries
 * that don't resolve to an existing stage; returns the count of updated stages.
 *
 * Performance: dispatched as a SINGLE bulk SQL statement using
 * `UPDATE … FROM (VALUES …)` — one round-trip regardless of node count.
 * (An earlier Promise.all-of-updateMany version still serialized in practice
 * on Neon's pooler, so we drop to raw SQL for guaranteed parallelism.)
 * Autosave fires every 1.5s on drag, so this matters a lot on a remote DB.
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

  // Build a (canonicalId, position-jsonb) tuple list and run one UPDATE
  // joining the workflow's stages against it. Postgres' VALUES form lets us
  // ship N updates in one statement.
  const valueRows = body.positions.map(
    (entry) =>
      Prisma.sql`(${entry.canonicalId}, ${JSON.stringify(entry.position)}::jsonb)`,
  );
  const updated = await prisma.$executeRaw`
    UPDATE "WorkflowStage" AS s
    SET "position" = v.pos
    FROM (VALUES ${Prisma.join(valueRows)}) AS v(cid, pos)
    WHERE s."workflowId" = ${workflowId}
      AND s."canonicalId" = v.cid
  `;
  return { updated };
};
