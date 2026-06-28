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
import {
  assertCanFillForm,
  bindingAccessSelect,
  canFillForm,
  canReadForm,
  loadActor,
} from './stage-form.access';

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
export const listForTicket = async (ticketId: string, userId: string) => {
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
    select: { ...bindingSelect, ...bindingAccessSelect },
  });

  const actor = await loadActor(prisma, userId);

  // Batch-resolve fill-role members for EACH-mode bindings (one query). A user
  // has a single roleId, so we map roleId → member ids and expand per binding.
  const eachRoleIds = new Set<string>();
  for (const b of bindings) {
    if (b.fillMode === 'EACH') for (const r of b.allowedFillRoles) eachRoleIds.add(r.id);
  }
  const roleMembers = new Map<string, string[]>();
  if (eachRoleIds.size > 0) {
    const members = await prisma.user.findMany({
      where: { roleId: { in: [...eachRoleIds] }, isActive: true },
      select: { id: true, roleId: true },
    });
    for (const m of members) {
      if (!m.roleId) continue;
      const list = roleMembers.get(m.roleId);
      if (list) list.push(m.id);
      else roleMembers.set(m.roleId, [m.id]);
    }
  }

  // Scope submissions to the CURRENT visit of each stage. After a RETURN the
  // ticket re-enters with a fresh tracking row; submissions from a prior visit
  // must not surface as "latest" or the UI would show the form as already
  // submitted and the user couldn't re-fill it. Mirrors the engine gate in
  // workflow/engine/form.layer.ts → findUnsatisfiedRequiredForms.
  const trackings = await prisma.ticketStageTracking.findMany({
    where: { ticketId, stageId: { in: currentStageIds }, isActive: true },
    orderBy: { enteredAt: 'desc' },
    select: { stageId: true, enteredAt: true },
  });
  const enteredByStage = new Map<string, Date>();
  for (const t of trackings) {
    if (!t.stageId) continue;
    if (!enteredByStage.has(t.stageId)) enteredByStage.set(t.stageId, t.enteredAt);
  }

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
      createdAt: true,
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // For each binding, find the latest submission keyed by (stageId, formId)
  // that was created during the current visit. Drop older rows so a returned-
  // to stage looks fresh. `createdAt` is only used here for the visit filter
  // and is stripped from the returned shape so the API contract is unchanged.
  type SubmissionRow = (typeof submissions)[number];
  type SubmissionOut = Omit<SubmissionRow, 'createdAt'>;
  const submissionByKey = new Map<string, SubmissionOut>();
  // Distinct SUBMITTED submitters per (stageId, formId) within the current
  // visit — drives EACH-mode progress ("3 of 5 submitted").
  const submittedByKey = new Map<string, Set<string>>();
  for (const s of submissions) {
    if (!s.stageId) continue;
    const since = enteredByStage.get(s.stageId);
    if (since && s.createdAt < since) continue;
    const key = `${s.stageId}:${s.formId}`;
    if (!submissionByKey.has(key)) {
      const { createdAt: _omit, ...rest } = s;
      submissionByKey.set(key, rest);
    }
    if (s.status === 'SUBMITTED' && s.submittedBy) {
      let set = submittedByKey.get(key);
      if (!set) submittedByKey.set(key, (set = new Set()));
      set.add(s.submittedBy.id);
    }
  }

  return {
    bindings: bindings.map((b) => {
      const {
        allowedFillRoles,
        allowedFillUsers,
        allowedViewRoles,
        allowedViewUsers,
        ...rest
      } = b;
      const access = {
        fillMode: b.fillMode,
        allowedFillRoles,
        allowedFillUsers,
        allowedViewRoles,
        allowedViewUsers,
      };
      const canRead = canReadForm(access, actor);
      const canFill = canFillForm(access, actor);
      const key = `${b.stageId}:${b.formId}`;

      // EACH mode: expand fill roles → members, union named fill users, and
      // count how many have submitted their own copy this visit.
      let eachProgress: {
        expectedCount: number;
        submittedCount: number;
        submittedByMe: boolean;
      } | null = null;
      if (b.fillMode === 'EACH') {
        const expected = new Set(allowedFillUsers.map((u) => u.id));
        for (const r of allowedFillRoles)
          for (const uid of roleMembers.get(r.id) ?? []) expected.add(uid);
        const submitted = submittedByKey.get(key) ?? new Set<string>();
        let submittedCount = 0;
        for (const id of expected) if (submitted.has(id)) submittedCount++;
        eachProgress = {
          expectedCount: expected.size,
          submittedCount,
          submittedByMe: submitted.has(userId),
        };
      }

      return {
        ...rest,
        fillMode: b.fillMode,
        canRead,
        canFill,
        eachProgress,
        // Never leak content/status to users without read access.
        latestSubmission: canRead
          ? submissionByKey.get(key) ?? null
          : null,
      };
    }),
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
      ...bindingAccessSelect,
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

  // Per-form fill gate: only the fill group may submit (view-only users and
  // users in neither list are rejected). Applies to drafts and submissions.
  await assertCanFillForm(prisma, binding, submittedById);

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
