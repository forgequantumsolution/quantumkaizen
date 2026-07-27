import { Prisma } from '@prisma/client';
import type { StageType } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../../lib/httpError';
import { assertCanPerformAction } from './access.layer';
import { assertRiskCriteria, isRiskCriteriaKind } from '../../../lib/stage-criteria/risk-criteria';
import {
  closeStageTracking,
  openStageTracking,
  setHoldOnActiveTracking,
} from './tracking.layer';
import { advanceFlow } from './transition.layer';
import { resolveNextStages } from './graph.layer';
import { startBranches, markBranchCompleted } from './parallel.handler';
import { emitAuditEvent } from './audit.emitter';
import * as approvalLayer from './approval.layer';
import { findUnsatisfiedRequiredForms } from './form.layer';
import { onTicketHeld, onTicketResumed } from './sla.handler';
import { resolveLatestVersion } from '../workflow.versioning';
import { ensureDefaultSite } from '../../../lib/site-defaults';
import { syncTicketComplianceFindings } from '../../audit/audit-compliance-sync.service';
import { syncTicketFindingsOnComplete } from '../../finding/finding-sync.service';
import { syncCapaFromTicketId } from '../../audit/capa.service';
import type {
  ActorContext,
  PerformActionPayload,
  PerformActionPayloadWithApproval,
  PerformActionResult,
} from './types';

type Tx = Prisma.TransactionClient;

const TX_OPTIONS = { timeout: 30_000, maxWait: 5_000 };

// ─── Ticket ID generation ───────────────────────────────────────────────────

/**
 * Generate a unique ticket ID like `DOC-FQS-001` per workflow.
 * Concurrent raises are serialised by the surrounding transaction's row lock
 * on the workflow row (acquired via `SELECT FOR UPDATE` below).
 */
const generateUniqueTicketId = async (
  tx: Tx,
  workflowId: string,
  prefix: string
): Promise<string> => {
  // Serialise per-workflow ticket-id allocation. Locking the workflow row
  // means two concurrent raises against the same workflow queue up; raises
  // against different workflows still run in parallel.
  await tx.$queryRaw`SELECT id FROM "Workflow" WHERE id = ${workflowId} FOR UPDATE`;

  // Look up the highest existing ticket with this prefix across ALL workflows
  // (not just `workflowId`). Multiple workflows can share a `codePrefix`
  // (e.g. several workflows of the same WorkflowType), and uniqueId is
  // GLOBALLY unique — so scoping per-workflow would let a new workflow
  // collide with already-allocated ids on a sibling workflow.
  //
  // Also skip SLA escalation children (named `{parent}-SLA`) — their tail
  // parses to NaN and would reset the counter to 1.
  const last = await tx.ticket.findFirst({
    where: {
      uniqueId: { startsWith: `${prefix}-FQS-` },
      parentTicketId: null,
    },
    orderBy: { uniqueId: 'desc' },
    select: { uniqueId: true },
  });

  let next = 1;
  if (last) {
    const tail = last.uniqueId.split('-').pop();
    const n = Number(tail);
    if (!Number.isNaN(n)) next = n + 1;
  }

  for (let i = 0; i < 5; i++) {
    const candidate = `${prefix}-FQS-${String(next).padStart(3, '0')}`;
    const exists = await tx.ticket.findUnique({
      where: { uniqueId: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    next++;
  }
  throw Conflict('Could not allocate a unique ticket id');
};

// ─── raiseTicket ────────────────────────────────────────────────────────────

export interface RaiseTicketInput {
  workflowId: string;
  title: string;
  description?: string;
  ticketReason?: string;
  priorityId?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
  severityId?: string | null;
  dueDate?: string | Date | null;
  classification?:
    | 'PRODUCT'
    | 'PROCESS'
    | 'SYSTEM'
    | 'EQUIPMENT'
    | 'DOCUMENTATION'
    | 'TRAINING'
    | 'OTHER'
    | null;
  parentTicketId?: string | null;
  parentTicketStageId?: string | null;
  customFields?: Record<string, unknown>;
}

export const raiseTicket = async (
  input: RaiseTicketInput,
  actor: ActorContext
): Promise<{ ticketId: string; flowId: string; uniqueId: string }> => {
  return prisma.$transaction(async (tx) => {
    // Resolve the latest version in this workflow's lineage. If the caller
    // happened to pass an older version's id (e.g. from a stale FE cache),
    // we silently advance to the head — tickets always start on the most
    // recent definition.
    const latestId = await resolveLatestVersion(tx, input.workflowId);

    const workflow = await tx.workflow.findUnique({
      where: { id: latestId },
      select: {
        id: true,
        name: true,
        version: true,
        isDeleted: true,
        workflowStatus: true,
        type: { select: { codePrefix: true } },
      },
    });
    if (!workflow) throw NotFound('Workflow not found');
    if (workflow.isDeleted) throw BadRequest('Workflow is deleted');
    if (workflow.workflowStatus !== 'ACTIVE')
      throw BadRequest(`Workflow is ${workflow.workflowStatus}; only ACTIVE workflows accept tickets`);

    // Find the initial stage
    const initial = await tx.workflowStage.findFirst({
      where: { workflowId: workflow.id, isInitialStage: true, isDeleted: false },
      select: { id: true, name: true, workflowId: true },
    });
    if (!initial) throw BadRequest('Workflow has no initial stage');

    const prefix = workflow.type?.codePrefix?.toUpperCase() || 'WF';
    const uniqueId = await generateUniqueTicketId(tx, workflow.id, prefix);

    // Site is mandatory for scoping — a site-less ticket falls outside every
    // user's scope and becomes invisible once enforcement is on. Resolve in
    // order: explicit siteId → parent ticket's site (child/CAPA/OOS spawns) →
    // the actor's own site → the default HQ site.
    let resolvedSiteId = input.siteId ?? null;
    if (!resolvedSiteId && input.parentTicketId) {
      const parent = await tx.ticket.findUnique({
        where: { id: input.parentTicketId },
        select: { siteId: true },
      });
      resolvedSiteId = parent?.siteId ?? null;
    }
    if (!resolvedSiteId) {
      const actorUser = await tx.user.findUnique({
        where: { id: actor.id },
        select: { siteId: true },
      });
      resolvedSiteId = actorUser?.siteId ?? null;
    }
    if (!resolvedSiteId) resolvedSiteId = await ensureDefaultSite();

    const ticket = await tx.ticket.create({
      data: {
        uniqueId,
        title: input.title,
        description: input.description ?? null,
        ticketReason: input.ticketReason ?? null,
        priorityId: input.priorityId ?? null,
        departmentId: input.departmentId ?? null,
        siteId: resolvedSiteId,
        severityId: input.severityId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        classification: input.classification ?? null,
        parentTicketId: input.parentTicketId ?? null,
        parentTicketStageId: input.parentTicketStageId ?? null,
        customFields: input.customFields
          ? (input.customFields as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdById: actor.id,
      },
      select: { id: true },
    });

    const flow = await tx.ticketFlow.create({
      data: {
        ticketId: ticket.id,
        workflowId: workflow.id,
        workflowName: workflow.name,
        workflowVersion: workflow.version,
        currentStages: { connect: [{ id: initial.id }] },
      },
      select: { id: true },
    });

    await openStageTracking(tx, ticket.id, initial);

    await emitAuditEvent(
      tx,
      { ticketId: ticket.id, workflowId: workflow.id, flowId: flow.id },
      'TICKET_RAISED',
      { uniqueId, title: input.title, initialStageId: initial.id },
      actor
    );

    return { ticketId: ticket.id, flowId: flow.id, uniqueId };
  }, TX_OPTIONS);
};

// ─── getCurrentStageActions ─────────────────────────────────────────────────

export interface StageActionView {
  stageId: string;
  stageName: string;
  stageCanonicalId: string;
  stageType: StageType;
  actions: {
    id: string;
    name: string;
    behavior: string;
    isPrimary: boolean;
    canPerform: boolean;
    canPerformReason?: string;
  }[];
}

export const getCurrentStageActions = async (
  ticketId: string,
  actor: ActorContext
): Promise<StageActionView[]> => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      isDeleted: true,
      flows: {
        select: {
          id: true,
          currentStages: {
            select: {
              id: true,
              name: true,
              canonicalId: true,
              stageType: true,
              actions: {
                where: { isDeleted: false },
                select: {
                  id: true,
                  isPrimary: true,
                  workflowAction: { select: { name: true, behavior: true } },
                  allowedRoles: { select: { id: true } },
                  allowedUsers: { select: { id: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!ticket) throw NotFound('Ticket not found');
  if (ticket.isDeleted) throw BadRequest('Ticket has been deleted');

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { roleId: true },
  });
  const userRoleId = user?.roleId ?? null;

  const views: StageActionView[] = [];
  for (const flow of ticket.flows) {
    for (const stage of flow.currentStages) {
      views.push({
        stageId: stage.id,
        stageName: stage.name,
        stageCanonicalId: stage.canonicalId,
        stageType: stage.stageType,
        actions: stage.actions.map((a) => {
          const open = a.allowedRoles.length === 0 && a.allowedUsers.length === 0;
          const inUsers = a.allowedUsers.some((u) => u.id === actor.id);
          const inRoles =
            !!userRoleId && a.allowedRoles.some((r) => r.id === userRoleId);
          const canPerform = open || inUsers || inRoles;
          return {
            id: a.id,
            name: a.workflowAction.name,
            behavior: a.workflowAction.behavior,
            isPrimary: a.isPrimary,
            canPerform,
            canPerformReason: canPerform ? undefined : 'Not allowed by RBAC',
          };
        }),
      });
    }
  }
  return views;
};

// ─── performAction ──────────────────────────────────────────────────────────

const FORK_TYPE: StageType = 'FORK';
const JOIN_TYPE: StageType = 'JOIN';

export const performAction = async (
  ticketId: string,
  actionId: string,
  actor: ActorContext,
  payload: PerformActionPayloadWithApproval = {}
): Promise<PerformActionResult> => {
  const result = await prisma.$transaction<PerformActionResult>(async (tx) => {
    // Lock the ticket row to serialise concurrent transitions
    await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;

    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        // Human reference, so a blocked transition can name the ticket.
        uniqueId: true,
        isDeleted: true,
        isOnHold: true,
        customFields: true,
        flows: {
          select: {
            id: true,
            isCompleted: true,
            workflowId: true,
            currentStages: { select: { id: true, stageType: true, splitType: true, name: true, canonicalId: true, joinPointId: true, workflowId: true } },
          },
        },
      },
    });
    if (!ticket) throw NotFound('Ticket not found');
    if (ticket.isDeleted) throw BadRequest('Ticket has been deleted');
    if (ticket.isOnHold) throw Conflict('Ticket is on hold; resume before transitioning');
    const flow = ticket.flows[0];
    if (!flow) throw BadRequest('Ticket has no active flow');
    if (flow.isCompleted) throw Conflict('Ticket flow is already completed');

    const action = await tx.workflowStageAction.findUnique({
      where: { id: actionId },
      select: {
        id: true,
        workflowStageId: true,
        isDeleted: true,
        workflowAction: { select: { behavior: true, name: true } },
        allowedRoles: { select: { id: true } },
        allowedUsers: { select: { id: true } },
        // Evaluable stage criteria (risk gate). `kind` is null on every
        // pre-existing criterion, which the evaluator treats as a pass.
        criteria: { select: { id: true, name: true, kind: true, config: true, isDeleted: true } },
      },
    });
    if (!action || action.isDeleted) throw NotFound('Action not found');

    const currentStage = flow.currentStages.find(
      (s) => s.id === action.workflowStageId
    );
    if (!currentStage) {
      throw BadRequest('Action does not belong to a stage the ticket is currently on');
    }

    await assertCanPerformAction(tx, action, actor.id);

    // ── Risk gate ─────────────────────────────────────────────────────────
    // Evaluated after access and BEFORE the approval intercept: a change that
    // has not had its risk assessed must not consume an approval decision on
    // the way to being refused. Only criteria carrying a `kind` block; the
    // label-only rows every workflow already has are inert.
    if (action.criteria && !action.criteria.isDeleted && isRiskCriteriaKind(action.criteria.kind)) {
      await assertRiskCriteria(
        tx,
        action.criteria.kind,
        action.criteria.config,
        ticket.id,
        ticket.uniqueId,
        { overridden: payload.riskGateOverride === true },
      );
    }

    // ── Phase 3 approval intercept ────────────────────────────────────────
    // If this (stage, action) has a policy, route through approval.layer.
    // - If decision REJECTED → instance flips REJECTED + audit event; ticket
    //   stays in stage (Q5).
    // - If approval pending more decisions → return `pending_approval`.
    // - If satisfied → fall through to the existing behavior dispatch.
    const policy = await approvalLayer.getPolicy(tx, currentStage.id, action.id);
    if (policy && policy.isActive && !policy.isDeleted) {
      const instance = await approvalLayer.ensureInstance(tx, ticket.id, policy, action.id);
      const decision = payload.approvalDecision ?? 'APPROVED';
      const decideResult = await approvalLayer.decide(tx, {
        instanceId: instance.id,
        decision,
        comment: payload.approvalComment ?? payload.remarks ?? null,
        actor,
      });
      if (decideResult.status === 'rejected') {
        // Approval rejected → terminate the ticket (clear stages + mark the
        // flow rejected). Reject means stop — no walk-back to a prior stage.
        const { exitedStages } = await terminateTicketAsRejected(tx, {
          ticketId: ticket.id,
          actor,
          actionId: action.id,
          remarks: payload.approvalComment ?? payload.remarks ?? null,
          reason: 'APPROVAL_REJECTED',
        });
        return {
          status: 'rejected',
          ticketId: ticket.id,
          flowId: flow.id,
          enteredStages: [],
          exitedStages,
          isCompleted: true,
          approval: { instanceId: decideResult.instanceId },
        };
      }
      if (decideResult.status === 'pending') {
        return {
          status: 'pending_approval',
          ticketId: ticket.id,
          flowId: flow.id,
          enteredStages: [],
          exitedStages: [],
          isCompleted: false,
          approval: {
            instanceId: decideResult.instanceId,
            remaining: decideResult.remaining,
          },
        };
      }
      // status === 'satisfied' — fall through to the existing behavior path.
    }

    // ── Phase 3.5 required-forms intercept ────────────────────────────────
    // After the approval gate, before behavior dispatch. Stage bindings with
    // isRequired=true block the transition until a SUBMITTED FormSubmission
    // exists for each (ticket, stage, formId). Standalone fills (no ticketId)
    // don't count. See docs/WORKFLOW_PHASE_3_5_PLAN.md §5.
    const unmetForms = await findUnsatisfiedRequiredForms(
      tx,
      ticket.id,
      currentStage.id,
    );
    if (unmetForms.length > 0) {
      throw BadRequest('Required forms not submitted', {
        formsRequired: unmetForms,
      });
    }

    const behavior = action.workflowAction.behavior;
    const customFields = (ticket.customFields ?? null) as Record<string, unknown> | null;

    let result: PerformActionResult;

    if (behavior === 'FORWARD') {
      result = await forwardAction(tx, {
        flowId: flow.id,
        ticketId: ticket.id,
        actorId: actor.id,
        actionId: action.id,
        currentStage,
        remarks: payload.remarks ?? null,
        customFields,
      });
    } else if (behavior === 'REJECT') {
      result = await rejectAction(tx, {
        flowId: flow.id,
        ticketId: ticket.id,
        actorId: actor.id,
        actionId: action.id,
        currentStage,
        remarks: payload.remarks ?? null,
      }, actor);
    } else if (behavior === 'HOLD') {
      result = await holdViaAction(tx, {
        flowId: flow.id,
        ticketId: ticket.id,
        actorId: actor.id,
        actionId: action.id,
        currentStage,
        remarks: payload.remarks ?? null,
      });
    } else if (behavior === 'UNHOLD') {
      result = await unholdViaAction(tx, {
        flowId: flow.id,
        ticketId: ticket.id,
        currentStage,
      });
    } else if (behavior === 'RETURN') {
      if (!payload.returnToStageId) throw BadRequest('returnToStageId is required for RETURN');
      result = await returnAction(tx, {
        flowId: flow.id,
        ticketId: ticket.id,
        actorId: actor.id,
        actionId: action.id,
        currentStage,
        returnToStageId: payload.returnToStageId,
        remarks: payload.remarks ?? null,
      });
    } else if (behavior === 'REASSIGN') {
      // Phase 2-lite: log only; full assignee model in Phase 3.
      result = {
        status: 'reassigned',
        ticketId: ticket.id,
        flowId: flow.id,
        enteredStages: [],
        exitedStages: [],
        isCompleted: false,
      };
      await emitAuditEvent(
        tx,
        { ticketId: ticket.id, flowId: flow.id },
        'STAGE_REASSIGNED',
        {
          stageId: currentStage.id,
          reassignToUserId: payload.reassignToUserId ?? null,
          reassignToRoleId: payload.reassignToRoleId ?? null,
          remarks: payload.remarks ?? null,
        },
        actor
      );
    } else {
      throw BadRequest(`Unsupported behavior: ${behavior}`);
    }

    await emitAuditEvent(
      tx,
      { ticketId: ticket.id, flowId: flow.id },
      'ACTION_PERFORMED',
      {
        actionId: action.id,
        actionName: action.workflowAction.name,
        behavior,
        stageId: currentStage.id,
      },
      actor
    );

    return result;
  }, TX_OPTIONS);

  // Post-commit, best-effort: when an audit ticket completes, roll its checklist
  // compliance dispositions up into Findings / Non-Conformances. Never let this
  // failing break the (already-committed) transition. A rejected ticket is
  // terminal-but-not-completed — skip the completion roll-ups for it.
  if (result.isCompleted && result.status === 'completed') {
    try {
      await syncTicketComplianceFindings(ticketId);
    } catch (err) {
      console.error('[audit] compliance sync failed for ticket', ticketId, err);
    }
    // Generic (non-audit) findings-enabled modules: same roll-up into the
    // generic Finding table. Best-effort + idempotent.
    try {
      await syncTicketFindingsOnComplete(ticketId);
    } catch (err) {
      console.error('[finding] finding sync failed for ticket', ticketId, err);
    }
  }

  // Post-commit, best-effort: keep a CAPA driven by this ticket in step with the
  // stage it just moved to (status mirror, implementedAt/closedAt, NC roll-up),
  // so completing/advancing from the ticket side updates the CAPA + list views
  // immediately — without waiting for the CAPA detail page to be opened.
  try {
    await syncCapaFromTicketId(ticketId);
  } catch (err) {
    console.error('[capa] status sync failed for ticket', ticketId, err);
  }

  return result;
};

// ─── action behaviors ───────────────────────────────────────────────────────

interface BehaviorContext {
  flowId: string;
  ticketId: string;
  actorId: string;
  actionId: string;
  currentStage: {
    id: string;
    name: string;
    canonicalId: string;
    stageType: StageType;
    splitType: 'AND' | 'OR' | 'XOR' | null;
    workflowId: string;
    joinPointId: string | null;
  };
  remarks?: string | null;
}

const forwardAction = async (
  tx: Tx,
  ctx: BehaviorContext & { customFields: Record<string, unknown> | null }
): Promise<PerformActionResult> => {
  // Close current stage tracking
  await closeStageTracking(tx, {
    ticketId: ctx.ticketId,
    stageId: ctx.currentStage.id,
    performedById: ctx.actorId,
    postActionId: ctx.actionId,
    remarks: ctx.remarks ?? null,
  });

  // Resolve next stages
  const nexts = await resolveNextStages(
    tx,
    ctx.currentStage,
    { customFields: ctx.customFields }
  );

  if (ctx.currentStage.stageType === FORK_TYPE) {
    await startBranches(tx, {
      ticketId: ctx.ticketId,
      forkStageId: ctx.currentStage.id,
      joinStageId: ctx.currentStage.joinPointId ?? null,
      branchStartStageIds: nexts.map((n) => n.stageId),
    });
  }

  // For each next stage, check if it's a JOIN — special handling
  const enteredStages: { id: string; name: string }[] = [];
  const finalConnect: string[] = [];

  for (const n of nexts) {
    const targetStage = await tx.workflowStage.findUnique({
      where: { id: n.stageId },
      select: { id: true, name: true, stageType: true, workflowId: true },
    });
    if (!targetStage) continue;

    if (targetStage.stageType === JOIN_TYPE) {
      const { allComplete } = await markBranchCompleted(tx, {
        ticketId: ctx.ticketId,
        arrivingAtJoinStageId: targetStage.id,
      });
      if (allComplete) {
        // Advance past the join: open tracking for the join briefly, then resolve its next
        await openStageTracking(tx, ctx.ticketId, targetStage);
        const afterJoin = await resolveNextStages(
          tx,
          { id: targetStage.id, stageType: JOIN_TYPE, splitType: null },
          { customFields: ctx.customFields }
        );
        // Close join tracking
        await closeStageTracking(tx, {
          ticketId: ctx.ticketId,
          stageId: targetStage.id,
          performedById: null,
        });
        for (const after of afterJoin) {
          const afterStage = await tx.workflowStage.findUnique({
            where: { id: after.stageId },
            select: { id: true, name: true, workflowId: true },
          });
          if (afterStage) {
            await openStageTracking(tx, ctx.ticketId, afterStage);
            enteredStages.push({ id: afterStage.id, name: afterStage.name });
            finalConnect.push(afterStage.id);
          }
        }
      }
      // If not all complete, ticket stays where it was (don't connect to join yet)
    } else {
      await openStageTracking(tx, ctx.ticketId, targetStage);
      enteredStages.push({ id: targetStage.id, name: targetStage.name });
      finalConnect.push(targetStage.id);
    }
  }

  // Update flow.currentStages
  const { isCompleted } = await advanceFlow(tx, ctx.flowId, {
    disconnectStageIds: [ctx.currentStage.id],
    connectStageIds: finalConnect,
  });

  return {
    status: isCompleted ? 'completed' : 'transitioned',
    ticketId: ctx.ticketId,
    flowId: ctx.flowId,
    exitedStages: [{ id: ctx.currentStage.id, name: ctx.currentStage.name }],
    enteredStages,
    isCompleted,
  };
};

/**
 * Terminal rejection. Clears every current stage of the ticket's active flow,
 * closes their tracking rows, and marks the flow rejected (and completed — no
 * current stages left). Once terminal, the ticket is no longer fillable or
 * actionable: the stage-form layer returns no bindings and the action bar shows
 * no stages. Shared by the REJECT-behavior action and approval rejection.
 */
export const terminateTicketAsRejected = async (
  tx: Tx,
  params: {
    ticketId: string;
    actor: ActorContext;
    actionId?: string | null;
    remarks?: string | null;
    reason?: string | null;
  }
): Promise<{ flowId: string; exitedStages: { id: string; name: string }[] }> => {
  const flow = await tx.ticketFlow.findFirst({
    where: { ticketId: params.ticketId, isCompleted: false },
    select: { id: true, currentStages: { select: { id: true, name: true } } },
  });
  if (!flow) throw BadRequest('Ticket has no active flow to reject');

  for (const stage of flow.currentStages) {
    await closeStageTracking(tx, {
      ticketId: params.ticketId,
      stageId: stage.id,
      performedById: params.actor.id,
      postActionId: params.actionId ?? null,
      remarks: params.remarks ?? null,
    });
  }

  // Disconnect all current stages → advanceFlow sees an empty set and flips the
  // flow to completed. We then stamp the rejection so status reads "Rejected".
  await advanceFlow(tx, flow.id, {
    disconnectStageIds: flow.currentStages.map((s) => s.id),
    connectStageIds: [],
  });
  await tx.ticketFlow.update({
    where: { id: flow.id },
    data: { isRejected: true, rejectedAt: new Date() },
  });

  await emitAuditEvent(
    tx,
    { ticketId: params.ticketId, flowId: flow.id },
    'TICKET_REJECTED',
    {
      exitedStageIds: flow.currentStages.map((s) => s.id),
      reason: params.reason ?? null,
      remarks: params.remarks ?? null,
    },
    params.actor
  );

  return { flowId: flow.id, exitedStages: flow.currentStages };
};

const rejectAction = async (
  tx: Tx,
  ctx: BehaviorContext,
  actor: ActorContext
): Promise<PerformActionResult> => {
  const { exitedStages } = await terminateTicketAsRejected(tx, {
    ticketId: ctx.ticketId,
    actor,
    actionId: ctx.actionId,
    remarks: ctx.remarks ?? null,
  });

  return {
    status: 'rejected',
    ticketId: ctx.ticketId,
    flowId: ctx.flowId,
    exitedStages,
    enteredStages: [],
    isCompleted: true,
  };
};

const holdViaAction = async (
  tx: Tx,
  ctx: BehaviorContext
): Promise<PerformActionResult> => {
  await tx.ticket.update({
    where: { id: ctx.ticketId },
    data: {
      isOnHold: true,
      holdReason: ctx.remarks ?? null,
      heldAt: new Date(),
      heldById: ctx.actorId,
    },
  });
  await setHoldOnActiveTracking(tx, ctx.ticketId, true, ctx.remarks ?? null);

  return {
    status: 'held',
    ticketId: ctx.ticketId,
    flowId: ctx.flowId,
    exitedStages: [],
    enteredStages: [],
    isCompleted: false,
  };
};

const unholdViaAction = async (
  tx: Tx,
  ctx: { flowId: string; ticketId: string; currentStage: { id: string; name: string } }
): Promise<PerformActionResult> => {
  await tx.ticket.update({
    where: { id: ctx.ticketId },
    data: {
      isOnHold: false,
      holdReason: null,
      heldAt: null,
      heldById: null,
    },
  });
  await setHoldOnActiveTracking(tx, ctx.ticketId, false);

  return {
    status: 'transitioned',
    ticketId: ctx.ticketId,
    flowId: ctx.flowId,
    exitedStages: [],
    enteredStages: [],
    isCompleted: false,
  };
};

const returnAction = async (
  tx: Tx,
  ctx: BehaviorContext & { returnToStageId: string }
): Promise<PerformActionResult> => {
  // Validate target was a previously-active stage
  const wasActive = await tx.ticketStageTracking.findFirst({
    where: { ticketId: ctx.ticketId, stageId: ctx.returnToStageId },
    select: { id: true },
  });
  if (!wasActive) throw BadRequest('Cannot return to a stage the ticket has not visited');

  const target = await tx.workflowStage.findUnique({
    where: { id: ctx.returnToStageId },
    select: { id: true, name: true, workflowId: true },
  });
  if (!target) throw NotFound('Target stage not found');

  await closeStageTracking(tx, {
    ticketId: ctx.ticketId,
    stageId: ctx.currentStage.id,
    performedById: ctx.actorId,
    postActionId: ctx.actionId,
    remarks: ctx.remarks ?? null,
    returnedFromStageId: ctx.currentStage.id,
  });
  await openStageTracking(tx, ctx.ticketId, target);

  await advanceFlow(tx, ctx.flowId, {
    disconnectStageIds: [ctx.currentStage.id],
    connectStageIds: [target.id],
  });

  return {
    status: 'returned',
    ticketId: ctx.ticketId,
    flowId: ctx.flowId,
    exitedStages: [{ id: ctx.currentStage.id, name: ctx.currentStage.name }],
    enteredStages: [{ id: target.id, name: target.name }],
    isCompleted: false,
  };
};

// ─── universal hold / resume ────────────────────────────────────────────────

export const holdTicket = async (
  ticketId: string,
  reason: string,
  actor: ActorContext
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { isDeleted: true, isOnHold: true },
    });
    if (!ticket) throw NotFound('Ticket not found');
    if (ticket.isDeleted) throw BadRequest('Ticket is deleted');
    if (ticket.isOnHold) throw Conflict('Ticket is already on hold');

    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        isOnHold: true,
        holdReason: reason,
        heldAt: new Date(),
        heldById: actor.id,
      },
    });
    await setHoldOnActiveTracking(tx, ticketId, true, reason);
    // Phase 3 SLA — pause active timers per policy.pauseOnHold.
    await onTicketHeld(tx, ticketId, actor);

    await emitAuditEvent(
      tx,
      { ticketId },
      'TICKET_HELD',
      { reason },
      actor
    );
  }, TX_OPTIONS);
};

export const resumeTicket = async (
  ticketId: string,
  actor: ActorContext
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { isDeleted: true, isOnHold: true },
    });
    if (!ticket) throw NotFound('Ticket not found');
    if (ticket.isDeleted) throw BadRequest('Ticket is deleted');
    if (!ticket.isOnHold) throw Conflict('Ticket is not on hold');

    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        isOnHold: false,
        holdReason: null,
        heldAt: null,
        heldById: null,
      },
    });
    await setHoldOnActiveTracking(tx, ticketId, false);
    // Phase 3 SLA — resume paused timers.
    await onTicketResumed(tx, ticketId, actor);

    await emitAuditEvent(tx, { ticketId }, 'TICKET_RESUMED', {}, actor);
  }, TX_OPTIONS);
};

