/**
 * StageFormBinding module service (Phase 3.5).
 *
 * Surface:
 *   listForWorkflow / getBinding / createBinding / updateBinding / softDeleteBinding
 *   listForTicket (returns bindings + latest submission for the ticket's current stage(s))
 *   createWorkflowSubmission (POST /tickets/:id/forms/:formId/submissions)
 *
 * Workflow-bound `FormSubmission` rows carry the (ticketId, stageId, flowId,
 * bindingId) FKs added by migration 20260516_add_stage_form_bindings. The
 * existing standalone `/forms` submission flow is unchanged — it leaves the
 * FKs null.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/httpError';
import type {
  CreateStageFormBindingInput,
  CreateWorkflowSubmissionInput,
  ListBindingsQuery,
  UpdateStageFormBindingInput,
} from './stage-form.schema';

// ─── Selects ───────────────────────────────────────────────────────────────

const bindingSelect = {
  id: true,
  workflowId: true,
  stageId: true,
  formId: true,
  isRequired: true,
  position: true,
  isActive: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  stage: { select: { id: true, name: true, canonicalId: true } },
  form: {
    select: {
      id: true,
      title: true,
      version: true,
      versionId: true,
      status: true,
    },
  },
} satisfies Prisma.StageFormBindingSelect;

// ─── Binding CRUD ──────────────────────────────────────────────────────────

export const listForWorkflow = async (
  workflowId: string,
  query: ListBindingsQuery,
) => {
  const where: Prisma.StageFormBindingWhereInput = {
    workflowId,
    isDeleted: false,
  };
  if (query.stageId) where.stageId = query.stageId;
  if (query.includeInactive !== 'true') where.isActive = true;

  return prisma.stageFormBinding.findMany({
    where,
    orderBy: [{ stageId: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    select: bindingSelect,
  });
};

export const getBinding = async (id: string) => {
  const row = await prisma.stageFormBinding.findUnique({
    where: { id },
    select: bindingSelect,
  });
  if (!row || row.isDeleted) throw NotFound(`StageFormBinding ${id} not found`);
  return row;
};

export const createBinding = async (
  workflowId: string,
  input: CreateStageFormBindingInput,
  createdById: string | null,
) => {
  // Validate that the stage actually belongs to this workflow.
  const stage = await prisma.workflowStage.findUnique({
    where: { id: input.stageId },
    select: { id: true, workflowId: true, isDeleted: true },
  });
  if (!stage || stage.isDeleted) throw NotFound('Stage not found');
  if (stage.workflowId !== workflowId) {
    throw BadRequest('Stage does not belong to this workflow');
  }

  const form = await prisma.form.findUnique({
    where: { id: input.formId },
    select: { id: true },
  });
  if (!form) throw NotFound('Form not found');

  // Soft-delete + recreate is allowed; the @@unique([stageId, formId]) catches
  // a duplicate active binding.
  try {
    return await prisma.stageFormBinding.create({
      data: {
        workflowId,
        stageId: input.stageId,
        formId: input.formId,
        isRequired: input.isRequired,
        position: input.position,
        createdById,
      },
      select: bindingSelect,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw Conflict('A binding for this form already exists on this stage');
    }
    throw err;
  }
};

export const updateBinding = async (id: string, input: UpdateStageFormBindingInput) => {
  const existing = await prisma.stageFormBinding.findUnique({
    where: { id },
    select: { id: true, isDeleted: true },
  });
  if (!existing || existing.isDeleted) {
    throw NotFound(`StageFormBinding ${id} not found`);
  }
  return prisma.stageFormBinding.update({
    where: { id },
    data: input,
    select: bindingSelect,
  });
};

export const softDeleteBinding = async (id: string) => {
  const existing = await prisma.stageFormBinding.findUnique({
    where: { id },
    select: { id: true, isDeleted: true },
  });
  if (!existing) throw NotFound(`StageFormBinding ${id} not found`);
  if (existing.isDeleted) return; // idempotent
  await prisma.stageFormBinding.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
  });
};

// ─── Ticket-scoped read ────────────────────────────────────────────────────

/**
 * Lists every binding for the ticket's current stage(s), each enriched with
 * the most recent submission for that (ticket, stage, formId) tuple. Empty
 * list means the current stage has no form requirements at all.
 */
export const listForTicket = async (ticketId: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      isDeleted: true,
      flows: {
        select: {
          id: true,
          currentStages: { select: { id: true } },
        },
      },
    },
  });
  if (!ticket || ticket.isDeleted) throw NotFound('Ticket not found');

  const currentStageIds = ticket.flows.flatMap((f) =>
    f.currentStages.map((s) => s.id),
  );
  if (currentStageIds.length === 0) return { bindings: [] };

  const bindings = await prisma.stageFormBinding.findMany({
    where: {
      stageId: { in: currentStageIds },
      isDeleted: false,
      isActive: true,
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: bindingSelect,
  });

  // Fetch the most recent submission per binding. Avoid N+1 with a single
  // grouped query — we want each binding's latest matching submission by
  // (ticketId, stageId, formId).
  const submissions = await prisma.formSubmission.findMany({
    where: {
      ticketId,
      stageId: { in: currentStageIds },
      formId: { in: bindings.map((b) => b.formId) },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      formId: true,
      stageId: true,
      bindingId: true,
      status: true,
      submittedAt: true,
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // For each binding, find the latest submission keyed by (stageId, formId).
  // The query above is desc by createdAt so the first match wins.
  const submissionByKey = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    const key = `${s.stageId}:${s.formId}`;
    if (!submissionByKey.has(key)) submissionByKey.set(key, s);
  }

  return {
    bindings: bindings.map((b) => ({
      ...b,
      latestSubmission: submissionByKey.get(`${b.stageId}:${b.formId}`) ?? null,
    })),
  };
};

// ─── Workflow-bound submission ─────────────────────────────────────────────

/**
 * Create a `FormSubmission` row with the workflow context populated. The
 * route's `formId` URL param must match the body's binding form id; the
 * binding's stage must be a current stage of the ticket; and the caller must
 * be able to reach the ticket (`ticket.read` is enforced at the route layer).
 */
export const createWorkflowSubmission = async (
  ticketId: string,
  formId: string,
  input: CreateWorkflowSubmissionInput,
  submittedById: string,
) => {
  // Lock the ticket + ensure it's reachable.
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      isDeleted: true,
      flows: {
        select: {
          id: true,
          currentStages: { select: { id: true } },
        },
      },
    },
  });
  if (!ticket || ticket.isDeleted) throw NotFound('Ticket not found');
  const currentStageIds = new Set(
    ticket.flows.flatMap((f) => f.currentStages.map((s) => s.id)),
  );

  // Verify the binding: belongs to a current stage, matches the route's formId.
  const binding = await prisma.stageFormBinding.findUnique({
    where: { id: input.bindingId },
    select: {
      id: true,
      stageId: true,
      formId: true,
      isDeleted: true,
      isActive: true,
      workflowId: true,
    },
  });
  if (!binding || binding.isDeleted || !binding.isActive) {
    throw NotFound('Form binding not found');
  }
  if (binding.formId !== formId) {
    throw BadRequest("Binding's form does not match the URL");
  }
  if (!currentStageIds.has(binding.stageId)) {
    throw Forbidden(
      'This form binding is not active on the ticket’s current stage',
    );
  }

  // Pick the flow that owns the binding's stage, so we stamp the right flow.
  const flow = ticket.flows.find((f) =>
    f.currentStages.some((s) => s.id === binding.stageId),
  );

  // Latest version of the logical form — submitted submissions store
  // `versionId` so we know which schema the payload was filled against.
  const latest = await prisma.form.findUnique({
    where: { id: binding.formId },
    select: { id: true, versionId: true },
  });
  if (!latest) throw NotFound('Form not found');

  const submission = await prisma.formSubmission.create({
    data: {
      formId: binding.formId,
      versionId: latest.versionId,
      status: input.status,
      responses: input.responses as Prisma.InputJsonValue,
      meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      submittedById,
      submittedAt: input.status === 'SUBMITTED' ? new Date() : null,
      ticketId,
      stageId: binding.stageId,
      flowId: flow?.id ?? null,
      bindingId: binding.id,
    },
    select: {
      id: true,
      formId: true,
      versionId: true,
      status: true,
      ticketId: true,
      stageId: true,
      flowId: true,
      bindingId: true,
      submittedAt: true,
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // TODO(Phase 4): emit `FORM_SUBMITTED` audit event when input.status === 'SUBMITTED'.

  return submission;
};
