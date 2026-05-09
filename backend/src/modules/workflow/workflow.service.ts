import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { validateWorkflowStructure } from './workflow.validator';
import { applyWorkflowSettings, buildWorkflowGraph } from './workflow.builder';
import type {
  CreateWorkflowShellInput,
  ListWorkflowsQuery,
  SaveWorkflowBody,
} from './workflow.schema';

export class WorkflowValidationError extends Error {
  constructor(public errors: string[]) {
    super('Workflow validation failed');
    this.name = 'WorkflowValidationError';
  }
}

const workflowSummarySelect = {
  id: true,
  name: true,
  status: true,
  workflowStatus: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  type: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { stages: true, transitions: true } },
} satisfies Prisma.WorkflowSelect;

const workflowDetailSelect = {
  id: true,
  name: true,
  status: true,
  workflowStatus: true,
  maxExecutionsPerDay: true,
  timeoutSeconds: true,
  totalExecutions: true,
  successfulExecutions: true,
  failedExecutions: true,
  lastExecutedAt: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  type: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  stages: {
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      canonicalId: true,
      isInitialStage: true,
      stageType: true,
      splitType: true,
      joinType: true,
      joinPointId: true,
      position: true,
      sendEmail: true,
      additionalData: true,
      actions: {
        where: { isDeleted: false },
        select: {
          id: true,
          isPrimary: true,
          criteriaId: true,
          workflowAction: { select: { id: true, name: true, behavior: true } },
          allowedRoles: { select: { id: true, name: true } },
          allowedUsers: { select: { id: true, name: true, email: true } },
        },
      },
    },
  },
  transitions: {
    where: { isDeleted: false },
    select: {
      id: true,
      sourcePort: true,
      targetPort: true,
      branchName: true,
      condition: true,
      branchOrder: true,
      fromStage: { select: { id: true, canonicalId: true } },
      toStage: { select: { id: true, canonicalId: true } },
    },
  },
} satisfies Prisma.WorkflowSelect;

type WorkflowDetail = Prisma.WorkflowGetPayload<{ select: typeof workflowDetailSelect }>;

const toFlowJson = (wf: WorkflowDetail) => {
  const stageById = new Map(wf.stages.map((s) => [s.id, s]));
  const nodes = wf.stages.map((stage) => ({
    id: stage.canonicalId || stage.id,
    type: stage.stageType.toLowerCase(),
    position: stage.position ?? { x: 0, y: 0 },
    data: {
      label: stage.name,
      nodeType: stage.stageType.toLowerCase(),
      basic_details: {
        is_initial_stage: stage.isInitialStage,
        email_notification: stage.sendEmail,
      },
      primary_actions: stage.actions
        .filter((a) => a.isPrimary)
        .map((a) => ({
          id: a.id,
          stage_status_id: a.workflowAction.id,
          stage_status_name: a.workflowAction.name,
          behavior: a.workflowAction.behavior,
          action_criteria_id: a.criteriaId,
          roles_id: a.allowedRoles.map((r) => r.id),
          employees_id: a.allowedUsers.map((u) => u.id),
        })),
      secondary_actions: stage.actions
        .filter((a) => !a.isPrimary)
        .map((a) => ({
          id: a.id,
          stage_status_id: a.workflowAction.id,
          stage_status_name: a.workflowAction.name,
          behavior: a.workflowAction.behavior,
          type: 'secondary',
          action_criteria_id: a.criteriaId,
          roles_id: a.allowedRoles.map((r) => r.id),
          employees_id: a.allowedUsers.map((u) => u.id),
        })),
      parallelConfig:
        stage.stageType === 'FORK' || stage.stageType === 'JOIN'
          ? {
              splitType: stage.splitType,
              joinType: stage.joinType,
              joinStageId: stage.joinPointId
                ? stageById.get(stage.joinPointId)?.canonicalId ?? null
                : null,
            }
          : undefined,
      additional_data: stage.additionalData,
    },
  }));

  const edges = wf.transitions.map((t) => ({
    id: t.id,
    source: t.fromStage.canonicalId || t.fromStage.id,
    target: t.toStage.canonicalId || t.toStage.id,
    sourceHandle: t.sourcePort,
    targetHandle: t.targetPort,
    label: t.branchName ?? undefined,
    branchInfo: {
      branchName: t.branchName ?? undefined,
      condition: t.condition ?? undefined,
      order: t.branchOrder,
    },
  }));

  return { nodes, edges };
};

export const list = async (query: ListWorkflowsQuery) => {
  const where: Prisma.WorkflowWhereInput = {};
  if (query.includeDeleted !== 'true') where.isDeleted = false;
  if (query.typeId) where.typeId = query.typeId;
  if (query.status) where.workflowStatus = query.status;
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      select: workflowSummarySelect,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.workflow.count({ where }),
  ]);

  return {
    items: items.map((w) => ({
      id: w.id,
      name: w.name,
      status: w.status,
      workflowStatus: w.workflowStatus,
      type: w.type,
      stageCount: w._count.stages,
      transitionCount: w._count.transitions,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
      createdBy: w.createdBy,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
};

export const getById = async (id: string) => {
  const wf = await prisma.workflow.findUnique({
    where: { id },
    select: workflowDetailSelect,
  });
  if (!wf) throw NotFound(`Workflow ${id} not found`);

  return {
    workflow: {
      id: wf.id,
      name: wf.name,
      status: wf.status,
      workflowStatus: wf.workflowStatus,
      type: wf.type,
      createdBy: wf.createdBy,
      createdAt: wf.createdAt.toISOString(),
      updatedAt: wf.updatedAt.toISOString(),
      isDeleted: wf.isDeleted,
      deletedAt: wf.deletedAt ? wf.deletedAt.toISOString() : null,
      settings: {
        maxExecutionsPerDay: wf.maxExecutionsPerDay,
        timeoutSeconds: wf.timeoutSeconds,
      },
      executions: {
        total: wf.totalExecutions,
        successful: wf.successfulExecutions,
        failed: wf.failedExecutions,
        lastAt: wf.lastExecutedAt ? wf.lastExecutedAt.toISOString() : null,
      },
    },
    flow_json: toFlowJson(wf),
    meta: { warnings: [] as string[] },
  };
};

export const createShell = async (
  input: CreateWorkflowShellInput,
  createdById: string | null
) => {
  if (input.typeId) {
    const type = await prisma.workflowType.findUnique({
      where: { id: input.typeId },
      select: { id: true, isDeleted: true },
    });
    if (!type || type.isDeleted) throw NotFound('Workflow type not found');
  }

  const wf = await prisma.workflow.create({
    data: {
      name: input.name,
      typeId: input.typeId ?? null,
      createdById,
    },
    select: workflowDetailSelect,
  });

  return {
    workflow: {
      id: wf.id,
      name: wf.name,
      status: wf.status,
      workflowStatus: wf.workflowStatus,
      type: wf.type,
      createdAt: wf.createdAt.toISOString(),
    },
  };
};

export const save = async (
  id: string,
  body: SaveWorkflowBody,
  userId: string | null
) => {
  // Step 1 — structural validation (outside the transaction)
  const errors = validateWorkflowStructure(body.flow_json.nodes, body.flow_json.edges);
  if (errors.length > 0) throw new WorkflowValidationError(errors);

  // Step 2 — transaction
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.workflow.findUnique({
        where: { id },
        select: {
          id: true,
          isDeleted: true,
          _count: { select: { stages: true } },
        },
      });
      if (!existing) throw NotFound(`Workflow ${id} not found`);
      if (existing.isDeleted) throw BadRequest('Cannot save a deleted workflow');

      // Versioning intentionally disabled — every save mutates the same row.
      // If the workflow already has stages, we wipe them first so the builder
      // can rebuild against an empty graph.
      if (existing._count.stages > 0) {
        await tx.workflowTransition.deleteMany({ where: { workflowId: id } });
        await tx.workflowStage.deleteMany({ where: { workflowId: id } });
      }

      await applyWorkflowSettings(tx, id, body.workflow_settings);

      const { warnings: graphWarnings } = await buildWorkflowGraph(
        tx,
        id,
        body.flow_json.nodes,
        body.flow_json.edges
      );

      const warnings = [...graphWarnings];
      if ((body.workflow_roles ?? []).length > 0) {
        warnings.push('Participant roles deferred to compliance phase');
      }

      const updated = await tx.workflow.findUnique({
        where: { id },
        select: { id: true },
      });

      return {
        status: true,
        msg: 'Workflow saved',
        workflow: updated,
        meta: { warnings },
      };
    },
    { timeout: 30_000, maxWait: 5_000 }
  );
};

export const softDelete = async (id: string, userId: string | null) => {
  const wf = await prisma.workflow.findUnique({
    where: { id },
    select: { id: true, isDeleted: true },
  });
  if (!wf) throw NotFound(`Workflow ${id} not found`);
  if (wf.isDeleted) throw BadRequest('Workflow already deleted');

  await prisma.workflow.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedById: userId,
    },
  });
};

// ─── TemporaryWorkflow autosave ───────────────────────────────────────────────

export const upsertDraft = async (workflowId: string, flowJson: unknown) => {
  const wf = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, isDeleted: true },
  });
  if (!wf) throw NotFound(`Workflow ${workflowId} not found`);
  if (wf.isDeleted) throw BadRequest('Cannot draft a deleted workflow');

  const jsonValue =
    flowJson === undefined || flowJson === null
      ? Prisma.JsonNull
      : (flowJson as Prisma.InputJsonValue);

  await prisma.temporaryWorkflow.upsert({
    where: { workflowId },
    update: { flowJson: jsonValue },
    create: { workflowId, flowJson: jsonValue },
  });
  return { status: true, msg: 'Draft saved' };
};

export const getDraft = async (workflowId: string) => {
  const wf = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true },
  });
  if (!wf) throw NotFound(`Workflow ${workflowId} not found`);

  const draft = await prisma.temporaryWorkflow.findUnique({
    where: { workflowId },
  });
  return { flow_json: draft?.flowJson ?? null };
};

