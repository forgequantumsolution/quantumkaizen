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
 * `StageFormBinding`, `ApprovalPolicy`, and `SlaPolicy` (with thresholds)
 * from the embedded data the FE includes in `flow_json` per stage. So we do
 * NOT clone those — doing so would duplicate rows and trip the
 * `@@unique([stageId, formId])` constraint on form bindings (and similar
 * implicit collisions on actions/policies).
 *
 * What we *do* clone explicitly: `ChildWorkflowTrigger`, since the builder
 * doesn't process its embedded representation yet (just warns about it).
 * Without this clone, a re-save would silently drop any child triggers
 * configured outside the builder.
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
 * Clone the workflow into a new version row, rebuild its graph from the
 * supplied flow_json, and copy over only the associations that
 * `buildWorkflowGraph` doesn't already materialise from embedded flow_json
 * data (currently just `ChildWorkflowTrigger`).
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
      status: true,
      workflowStatus: true,
      maxExecutionsPerDay: true,
      timeoutSeconds: true,
      version: true,
      parentWorkflowId: true,
      isDeleted: true,
      stages: {
        where: { isDeleted: false },
        select: {
          id: true,
          canonicalId: true,
          // ChildWorkflowTrigger is the one association the builder doesn't
          // re-materialise from flow_json yet, so we have to carry it.
          childTriggers: {
            select: {
              id: true,
              childWorkflowId: true,
              triggerMode: true,
              isBlocking: true,
              allowMultiple: true,
              order: true,
            },
          },
        },
      },
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

  // Map old stages → new stages by canonicalId so the explicit clone below
  // can resolve targets.
  const newStages = await tx.workflowStage.findMany({
    where: { workflowId: newWf.id, isDeleted: false },
    select: { id: true, canonicalId: true },
  });
  const newStageByCanonical = new Map<string, string>();
  for (const s of newStages) newStageByCanonical.set(s.canonicalId, s.id);

  // ── Clone ChildWorkflowTriggers ────────────────────────────────────────
  // These aren't carried in flow_json (the builder only emits a deferred
  // warning for them). If we didn't copy them, a re-save would silently
  // strip every trigger a workflow had attached.
  for (const oldStage of old.stages) {
    const newStageId = newStageByCanonical.get(oldStage.canonicalId);
    if (!newStageId) continue;
    for (const ct of oldStage.childTriggers) {
      await tx.childWorkflowTrigger.create({
        data: {
          parentStageId: newStageId,
          childWorkflowId: ct.childWorkflowId,
          triggerMode: ct.triggerMode,
          isBlocking: ct.isBlocking,
          allowMultiple: ct.allowMultiple,
          order: ct.order,
        },
      });
    }
  }

  // Mark old as no-longer-latest. New tickets land on newWf.id; in-flight
  // tickets stay pinned to the old id via their TicketFlow.workflowId.
  await tx.workflow.update({
    where: { id: old.id },
    data: { isLatestVersion: false },
  });

  return { newWorkflowId: newWf.id, warnings };
};
