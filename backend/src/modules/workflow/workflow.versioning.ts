/**
 * Workflow versioning.
 *
 * Re-introduced after P1.8 (where versioning was temporarily removed). When a
 * workflow that already has stages is saved, we DO NOT mutate the existing
 * row anymore — every existing ticket FK-references those stage rows (m2m
 * `TicketFlow.currentStages`, `TicketStageTracking`, `ApprovalInstance` via
 * its policy, `SlaTimer` via its policy, `StageFormBinding.submissions`,
 * `TicketDoc.stageId`, `ParallelBranchTracking`, etc.) and a destructive
 * delete-and-recreate of the stage rows wedges every in-flight ticket on
 * that workflow.
 *
 * Instead, save() creates a *new* `Workflow` row with `version = old + 1`,
 * `isLatestVersion = true`, `previousVersionId = old.id`. The old row keeps
 * its stages intact so live tickets continue advancing through the
 * definition they were raised against. New tickets land on whatever the
 * engine resolves as "latest" in the lineage (see `resolveLatestVersion`).
 *
 * NOTE on what gets cloned. `buildWorkflowGraph` already re-creates
 * `WorkflowStage`, `WorkflowStageAction`, `WorkflowTransition`,
 * `StageFormBinding`, `ApprovalPolicy`, `SlaPolicy` (with thresholds), and
 * `ChildWorkflowTrigger` from the embedded data the FE includes in `flow_json`
 * per stage. So we do NOT clone those — doing so would duplicate rows and trip
 * the `@@unique([stageId, formId])` constraint on form bindings (and similar
 * implicit collisions on actions/policies/triggers).
 *
 * (There are no longer any associations we clone explicitly — everything the
 * builder can round-trip through flow_json is rebuilt by `buildWorkflowGraph`.)
 */
import { Prisma } from '@prisma/client';
import { buildWorkflowGraph, applyWorkflowSettings } from './workflow.builder';
import type { SaveWorkflowBody } from './workflow.schema';
import { BadRequest, NotFound } from '../../lib/httpError';
// NOTE: must not import from workflow.service — that would form a circular
// dependency with save() and leave one side undefined at runtime under tsx
// watch. Validation is handled by save() before the transaction enters
// cloneIntoNewVersion.

type Tx = Prisma.TransactionClient;

/**
 * Walk a workflow lineage to its latest version. Lineage root is
 * `parentWorkflowId` (or `id` if this is the root). Returns the row in that
 * lineage where `isLatestVersion = true` and `isDeleted = false`.
 *
 * If the passed id is already the latest, no extra query — we just return it
 * with one round-trip.
 */
export const resolveLatestVersion = async (tx: Tx, workflowId: string) => {
  const wf = await tx.workflow.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      isLatestVersion: true,
      isDeleted: true,
      parentWorkflowId: true,
    },
  });
  if (!wf) throw NotFound(`Workflow ${workflowId} not found`);
  if (wf.isLatestVersion && !wf.isDeleted) return wf.id;

  const lineageRoot = wf.parentWorkflowId ?? wf.id;
  const latest = await tx.workflow.findFirst({
    where: {
      isLatestVersion: true,
      isDeleted: false,
      OR: [{ id: lineageRoot }, { parentWorkflowId: lineageRoot }],
    },
    select: { id: true },
  });
  if (!latest) throw NotFound(`No active version found in workflow lineage`);
  return latest.id;
};

/**
 * Clone the workflow into a new version row and rebuild its graph from the
 * supplied flow_json. `buildWorkflowGraph` materialises every association from
 * the embedded per-stage data, so there is nothing left to copy explicitly.
 *
 * Returns the new workflow id (the canonical "latest" id callers should
 * navigate to).
 */
export const cloneIntoNewVersion = async (
  tx: Tx,
  oldId: string,
  body: SaveWorkflowBody,
  userId: string | null,
): Promise<{ newWorkflowId: string; warnings: string[] }> => {
  // (save() has already run validateWorkflowStructure before opening the tx.)

  // Read the old workflow — only the bits we still clone explicitly.
  const old = await tx.workflow.findUnique({
    where: { id: oldId },
    select: {
      id: true,
      name: true,
      typeId: true,
      siteId: true,
      status: true,
      workflowStatus: true,
      maxExecutionsPerDay: true,
      timeoutSeconds: true,
      version: true,
      parentWorkflowId: true,
      isDeleted: true,
    },
  });

  if (!old) throw NotFound(`Workflow ${oldId} not found`);
  if (old.isDeleted) throw BadRequest('Cannot save a deleted workflow');

  // Create new workflow row inheriting top-level metadata + lifecycle.
  const lineageRoot = old.parentWorkflowId ?? old.id;
  const newWf = await tx.workflow.create({
    data: {
      name: old.name,
      typeId: old.typeId,
      // Carry site ownership across versions — a re-save must not silently
      // globalize a site-owned workflow (docs/workflow-site-ownership-plan.md).
      siteId: old.siteId,
      status: old.status,
      workflowStatus: old.workflowStatus,
      maxExecutionsPerDay: old.maxExecutionsPerDay,
      timeoutSeconds: old.timeoutSeconds,
      version: old.version + 1,
      isLatestVersion: true,
      previousVersionId: old.id,
      parentWorkflowId: lineageRoot,
      createdById: userId,
    },
    select: { id: true },
  });

  // Apply workflow settings, then build the new graph from flow_json. This
  // creates stages, actions, transitions, form bindings, approval policies,
  // and SLA policies (with thresholds) — everything embedded in flow_json.
  await applyWorkflowSettings(tx, newWf.id, body.workflow_settings);
  const { warnings: graphWarnings } = await buildWorkflowGraph(
    tx,
    newWf.id,
    body.flow_json.nodes,
    body.flow_json.edges,
  );

  const warnings = [...graphWarnings];
  if ((body.workflow_roles ?? []).length > 0) {
    warnings.push('Participant roles deferred to compliance phase');
  }

  // ChildWorkflowTriggers are now carried in flow_json and re-materialised by
  // buildWorkflowGraph above (like form bindings / SLA / approvals), so the old
  // explicit stage-by-stage clone is gone.

  // Mark old as no-longer-latest. New tickets land on newWf.id; in-flight
  // tickets stay pinned to the old id via their TicketFlow.workflowId.
  await tx.workflow.update({
    where: { id: old.id },
    data: { isLatestVersion: false },
  });

  return { newWorkflowId: newWf.id, warnings };
};
