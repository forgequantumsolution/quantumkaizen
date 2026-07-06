/**
 * Form-binding engine layer (Phase 3.5).
 *
 * Single entry point — `findUnsatisfiedRequiredForms(tx, ticketId, stageId)`.
 * The orchestrator calls this immediately after the approval intercept and
 * before behavior dispatch. If the result is non-empty, the action is
 * blocked with a 400 carrying the missing bindings (see
 * docs/WORKFLOW_PHASE_3_5_PLAN.md §5).
 *
 * "Satisfied" = there exists a `FormSubmission` row with status SUBMITTED
 * matching (ticketId, stageId, binding.formId) AND `submittedAt >=` the
 * current visit's `enteredAt`. Each entry into a stage (including via RETURN)
 * is an independent fill opportunity — submissions from a prior visit don't
 * unlock the gate the next time around. The submission's `versionId` is
 * allowed to be any version of the logical form (Q3 sign-off).
 */
import type { Prisma } from '@prisma/client';
import {
  bindingAccessSelect,
  expectedSubmitterIds,
  isOpenToAll,
} from '../../stage-form/stage-form.access';
import { isAuditFormsStage } from '../../../lib/auditFormsStage';

type Tx = Prisma.TransactionClient;

export interface UnsatisfiedFormBinding {
  bindingId: string;
  formId: string;
  title: string;
  /** How the form is satisfied — drives the "N of M" message for EACH mode. */
  mode: 'ANYONE' | 'EACH';
  /** EACH mode only: how many copies are expected / already submitted. */
  expectedCount?: number;
  submittedCount?: number;
}

export const findUnsatisfiedRequiredForms = async (
  tx: Tx,
  ticketId: string,
  stageId: string,
): Promise<UnsatisfiedFormBinding[]> => {
  const bindings = await tx.stageFormBinding.findMany({
    where: {
      stageId,
      isRequired: true,
      isActive: true,
      isDeleted: false,
    },
    select: {
      id: true,
      formId: true,
      form: { select: { title: true } },
      ...bindingAccessSelect,
    },
  });

  // Audit tickets carry their checklist on the linked AuditRegister (attached
  // from the audit master), surfaced as per-ticket virtual bindings rather than
  // real StageFormBinding rows (see stage-form.service.ts). Treat those as
  // required too — but skip the initial stage so the audit kickoff isn't blocked.
  const auditForms = await requiredAuditChecklistForms(tx, ticketId, stageId);

  if (bindings.length === 0 && auditForms.length === 0) return [];

  // Each stage entry is a fresh fill opportunity. After a RETURN the ticket
  // re-opens a tracking row with a new `enteredAt`; older submissions belonged
  // to the previous visit and must not satisfy the current one.
  const activeTracking = await tx.ticketStageTracking.findFirst({
    where: { ticketId, stageId, isActive: true },
    orderBy: { enteredAt: 'desc' },
    select: { enteredAt: true },
  });
  const since = activeTracking?.enteredAt ?? new Date(0);

  const out: UnsatisfiedFormBinding[] = [];

  // Real stage-form bindings — access-aware satisfaction (ANYONE vs EACH).
  if (bindings.length > 0) {
    const submissions = await tx.formSubmission.findMany({
      where: {
        ticketId,
        stageId,
        status: 'SUBMITTED',
        submittedAt: { gte: since },
        formId: { in: bindings.map((b) => b.formId) },
      },
      select: { formId: true, submittedById: true },
    });
    // Forms with ≥1 submitted copy this visit, and per-form distinct submitters.
    const anySubmitted = new Set<string>();
    const submittersByForm = new Map<string, Set<string>>();
    for (const s of submissions) {
      anySubmitted.add(s.formId);
      if (!s.submittedById) continue;
      let set = submittersByForm.get(s.formId);
      if (!set) submittersByForm.set(s.formId, (set = new Set()));
      set.add(s.submittedById);
    }

    for (const b of bindings) {
      const access = {
        isRestricted: b.isRestricted,
        fillMode: b.fillMode,
        allowedFillRoles: b.allowedFillRoles,
        allowedFillUsers: b.allowedFillUsers,
        allowedViewRoles: b.allowedViewRoles,
        allowedViewUsers: b.allowedViewUsers,
      };

      if (b.fillMode === 'EACH' && !isOpenToAll(access)) {
        // EACH: every expected person owes their own copy. Expected set is
        // computed from CURRENT role membership, so departed members drop out.
        const expected = await expectedSubmitterIds(tx, access);
        if (expected.length === 0) continue; // nobody to collect from → satisfied
        const submitters = submittersByForm.get(b.formId) ?? new Set<string>();
        const submittedCount = expected.filter((id) => submitters.has(id)).length;
        if (submittedCount < expected.length) {
          out.push({
            bindingId: b.id,
            formId: b.formId,
            title: b.form.title,
            mode: 'EACH',
            expectedCount: expected.length,
            submittedCount,
          });
        }
      } else {
        // ANYONE / legacy-open: one submitted copy this visit satisfies it.
        if (!anySubmitted.has(b.formId)) {
          out.push({
            bindingId: b.id,
            formId: b.formId,
            title: b.form.title,
            mode: b.fillMode,
          });
        }
      }
    }
  }

  // Audit checklist: satisfied ticket-wide (filled once on any working stage it
  // stays done), so the auditor isn't forced to re-submit at Verify / close.
  // These are virtual, legacy-open bindings → ANYONE semantics.
  if (auditForms.length > 0) {
    const realFormIds = new Set(bindings.map((b) => b.formId));
    const pending = auditForms.filter((f) => !realFormIds.has(f.formId));
    if (pending.length > 0) {
      const submitted = await tx.formSubmission
        .findMany({
          where: {
            ticketId,
            status: 'SUBMITTED',
            formId: { in: pending.map((f) => f.formId) },
          },
          select: { formId: true },
        })
        .then((rows) => new Set(rows.map((r) => r.formId)));
      for (const f of pending) {
        if (!submitted.has(f.formId)) {
          out.push({
            bindingId: `audit:${stageId}:${f.formId}`,
            formId: f.formId,
            title: f.title,
            mode: 'ANYONE',
          });
        }
      }
    }
  }

  return out;
};

/**
 * Checklist forms the linked audit register requires on this stage. Empty unless
 * the ticket is audit-linked (`customFields.audit_register_id`) AND this is the
 * audit-forms stage ("Perform Audit") — the only stage the dynamic checklist
 * appears on. Other stages gate only on their manually-bound forms.
 */
const requiredAuditChecklistForms = async (
  tx: Tx,
  ticketId: string,
  stageId: string,
): Promise<{ formId: string; title: string }[]> => {
  const stage = await tx.workflowStage.findUnique({
    where: { id: stageId },
    select: { name: true, stageType: true },
  });
  if (!stage || !isAuditFormsStage(stage)) return [];

  const ticket = await tx.ticket.findUnique({
    where: { id: ticketId },
    select: { customFields: true },
  });
  const cf = (ticket?.customFields ?? {}) as Record<string, unknown>;
  const registerId =
    typeof cf.audit_register_id === 'string' ? cf.audit_register_id : null;
  if (!registerId) return [];

  const reg = await tx.auditRegister.findUnique({
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
  if (ids.size === 0) return [];

  const forms = await tx.form.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, title: true },
  });
  return forms.map((f) => ({ formId: f.id, title: f.title }));
};
