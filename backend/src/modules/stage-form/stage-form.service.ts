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
import { isAuditFormsStage } from '../../lib/auditFormsStage';
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

// ─── Audit checklist (virtual bindings) ─────────────────────────────────────
//
// Audit tickets carry their selected checklist on the linked AuditRegister
// (per-register, chosen from the audit master), NOT as workflow-level
// StageFormBindings — binding them on the shared stage would leak every audit's
// checklist onto every other audit on the same workflow. Instead we surface the
// register's checklist forms as PER-TICKET virtual bindings whose id encodes the
// stage + form: `audit:<stageId>:<formId>`. Submissions for these are stored
// with bindingId = null but full (ticketId, stageId, formId) context, so they
// track + render through the same StageFormSection as real bindings.
const AUDIT_BINDING_PREFIX = 'audit:';

/** Distinct checklist Form ids selected on the audit register linked to this
 *  ticket (via customFields.audit_register_id). [] if not an audit ticket. */
const auditChecklistFormIds = async (
  customFields: Prisma.JsonValue | null | undefined,
): Promise<string[]> => {
  const cf = (customFields ?? {}) as Record<string, unknown>;
  const registerId =
    typeof cf.audit_register_id === 'string' ? cf.audit_register_id : null;
  if (!registerId) return [];

  const reg = await prisma.auditRegister.findUnique({
    where: { id: registerId },
    select: { checklistFormId: true, checklistAssignments: true },
  });
  if (!reg) return [];

  const ids = new Set<string>();
  const assignments = Array.isArray(reg.checklistAssignments)
    ? (reg.checklistAssignments as Array<{ checklist_form_id?: unknown }>)
    : [];
  for (const a of assignments) {
    if (a && typeof a.checklist_form_id === 'string') ids.add(a.checklist_form_id);
  }
  if (reg.checklistFormId) ids.add(reg.checklistFormId);
  return [...ids];
};

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
      customFields: true,
      flows: {
        select: {
          id: true,
          workflowId: true,
          currentStages: {
            select: { id: true, name: true, canonicalId: true, stageType: true },
          },
        },
      },
    },
  });
  if (!ticket || ticket.isDeleted) throw NotFound('Ticket not found');

  const currentStageIds = ticket.flows.flatMap((f) =>
    f.currentStages.map((s) => s.id),
  );
  if (currentStageIds.length === 0) return { bindings: [] };

  // Stage metadata for shaping virtual bindings (name/canonicalId/workflowId).
  const stageMeta = new Map<
    string,
    { name: string; canonicalId: string; workflowId: string; stageType: string }
  >();
  for (const f of ticket.flows) {
    for (const s of f.currentStages) {
      stageMeta.set(s.id, {
        name: s.name,
        canonicalId: s.canonicalId,
        workflowId: f.workflowId,
        stageType: s.stageType,
      });
    }
  }

  const realBindings = await prisma.stageFormBinding.findMany({
    where: {
      stageId: { in: currentStageIds },
      isDeleted: false,
      isActive: true,
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { ...bindingSelect, ...bindingAccessSelect },
  });

  const actor = await loadActor(prisma, userId);

  // Normalise real bindings to a plain shape so they merge cleanly with the
  // virtual audit-checklist bindings below. Access lists + fillMode are kept so
  // the per-form fill/view checks still apply to real bindings.
  const bindings = realBindings.map((b) => ({
    id: b.id,
    workflowId: b.workflowId,
    stageId: b.stageId,
    formId: b.formId,
    isRequired: b.isRequired,
    position: b.position,
    isActive: b.isActive,
    isDeleted: b.isDeleted,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    stage: b.stage,
    form: b.form,
    fillMode: b.fillMode,
    allowedFillRoles: b.allowedFillRoles,
    allowedFillUsers: b.allowedFillUsers,
    allowedViewRoles: b.allowedViewRoles,
    allowedViewUsers: b.allowedViewUsers,
  }));

  // Append the audit register's checklist(s) as per-ticket virtual bindings on
  // every current stage (deduped against any real binding for the same form).
  const auditFormIds = await auditChecklistFormIds(ticket.customFields);
  if (auditFormIds.length) {
    const auditForms = await prisma.form.findMany({
      where: { id: { in: auditFormIds } },
      select: { id: true, title: true, version: true, versionId: true, status: true },
    });
    const realKeys = new Set(bindings.map((b) => `${b.stageId}:${b.formId}`));
    const now = new Date();
    for (const stageId of currentStageIds) {
      const meta = stageMeta.get(stageId);
      if (!meta) continue;
      // The dynamic audit checklist appears ONLY on the audit-forms stage
      // ("Perform Audit"); other stages show only manually-bound forms.
      if (!isAuditFormsStage(meta)) continue;
      let position = 1000;
      for (const form of auditForms) {
        if (realKeys.has(`${stageId}:${form.id}`)) continue;
        bindings.push({
          id: `${AUDIT_BINDING_PREFIX}${stageId}:${form.id}`,
          workflowId: meta.workflowId,
          stageId,
          formId: form.id,
          isRequired: true,
          position: position++,
          isActive: true,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
          stage: { id: stageId, name: meta.name, canonicalId: meta.canonicalId },
          form,
          // Virtual audit checklists carry no access lists → legacy-open:
          // every member may read & fill them (ANYONE semantics).
          fillMode: 'ANYONE',
          allowedFillRoles: [],
          allowedFillUsers: [],
          allowedViewRoles: [],
          allowedViewUsers: [],
        });
      }
    }
  }

  if (bindings.length === 0) return { bindings: [] };

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

// ─── Submitted-forms history (read-only) ───────────────────────────────────

/**
 * Every SUBMITTED form/checklist on the ticket, across ALL stages it has passed
 * through — so filled forms remain viewable after the ticket leaves a stage or
 * completes (when `listForTicket` returns nothing because there's no current
 * stage). Current-stage submissions are excluded: those are already shown,
 * actionable, by the StageFormSection. Ordered oldest → newest.
 */
export const listSubmittedFormsForTicket = async (ticketId: string) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      isDeleted: true,
      flows: { select: { currentStages: { select: { id: true } } } },
    },
  });
  if (!ticket || ticket.isDeleted) throw NotFound('Ticket not found');

  const currentStageIds = new Set(
    ticket.flows.flatMap((f) => f.currentStages.map((s) => s.id)),
  );

  const subs = await prisma.formSubmission.findMany({
    where: { ticketId, status: 'SUBMITTED' },
    orderBy: { submittedAt: 'asc' },
    select: {
      id: true,
      formId: true,
      stageId: true,
      status: true,
      submittedAt: true,
      submittedBy: { select: { id: true, name: true, email: true } },
      form: { select: { title: true } },
      stage: { select: { name: true } },
    },
  });

  const submissions = subs
    // Skip the current stage's forms — StageFormSection renders those.
    .filter((s) => !s.stageId || !currentStageIds.has(s.stageId))
    .map((s) => ({
      id: s.id,
      formId: s.formId,
      formTitle: s.form?.title ?? 'Form',
      stageId: s.stageId,
      stageName: s.stage?.name ?? null,
      status: s.status,
      submittedAt: s.submittedAt,
      submittedBy: s.submittedBy,
    }));

  return { submissions };
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
      customFields: true,
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

  // Virtual audit-checklist binding (`audit:<stageId>:<formId>`): the form comes
  // from the linked audit register, not a StageFormBinding row. Validate the
  // stage is current and the form is one of the register's selected checklists,
  // then store the submission with bindingId = null but full stage context.
  if (input.bindingId.startsWith(AUDIT_BINDING_PREFIX)) {
    const rest = input.bindingId.slice(AUDIT_BINDING_PREFIX.length);
    const sep = rest.lastIndexOf(':');
    const stageId = sep > -1 ? rest.slice(0, sep) : '';
    const bindingFormId = sep > -1 ? rest.slice(sep + 1) : '';
    if (!stageId || !bindingFormId) throw BadRequest('Malformed audit form binding');
    if (bindingFormId !== formId) throw BadRequest("Binding's form does not match the URL");
    if (!currentStageIds.has(stageId)) {
      throw Forbidden('This checklist is not on the ticket’s current stage');
    }
    const allowed = await auditChecklistFormIds(ticket.customFields);
    if (!allowed.includes(formId)) {
      throw Forbidden('Form is not part of this audit’s checklist');
    }
    const flow = ticket.flows.find((f) =>
      f.currentStages.some((s) => s.id === stageId),
    );
    const latest = await prisma.form.findUnique({
      where: { id: formId },
      select: { id: true, versionId: true },
    });
    if (!latest) throw NotFound('Form not found');

    return prisma.formSubmission.create({
      data: {
        formId,
        versionId: latest.versionId,
        status: input.status,
        responses: input.responses as Prisma.InputJsonValue,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
        submittedById,
        submittedAt: input.status === 'SUBMITTED' ? new Date() : null,
        ticketId,
        stageId,
        flowId: flow?.id ?? null,
        bindingId: null,
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
  }

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
