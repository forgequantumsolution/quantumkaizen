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
  isLegacyOpen,
} from '../../stage-form/stage-form.access';

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
  if (bindings.length === 0) return [];

  // Each stage entry is a fresh fill opportunity. After a RETURN the ticket
  // re-opens a tracking row with a new `enteredAt`; older submissions belonged
  // to the previous visit and must not satisfy the current one.
  const activeTracking = await tx.ticketStageTracking.findFirst({
    where: { ticketId, stageId, isActive: true },
    orderBy: { enteredAt: 'desc' },
    select: { enteredAt: true },
  });
  const since = activeTracking?.enteredAt ?? new Date(0);

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

  const out: UnsatisfiedFormBinding[] = [];
  for (const b of bindings) {
    const access = {
      fillMode: b.fillMode,
      allowedFillRoles: b.allowedFillRoles,
      allowedFillUsers: b.allowedFillUsers,
      allowedViewRoles: b.allowedViewRoles,
      allowedViewUsers: b.allowedViewUsers,
    };

    if (b.fillMode === 'EACH' && !isLegacyOpen(access)) {
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
  return out;
};
