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
 * matching (ticketId, stageId, binding.formId). The submission's `versionId`
 * is allowed to be any version of the logical form (Q3 sign-off).
 */
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export interface UnsatisfiedFormBinding {
  bindingId: string;
  formId: string;
  title: string;
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
    },
  });
  if (bindings.length === 0) return [];

  // Pull every SUBMITTED submission for this ticket+stage in one query;
  // intersect locally with the binding formIds to find unsatisfied bindings.
  const submittedFormIds = await tx.formSubmission
    .findMany({
      where: {
        ticketId,
        stageId,
        status: 'SUBMITTED',
        formId: { in: bindings.map((b) => b.formId) },
      },
      select: { formId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.formId)));

  return bindings
    .filter((b) => !submittedFormIds.has(b.formId))
    .map((b) => ({
      bindingId: b.id,
      formId: b.formId,
      title: b.form.title,
    }));
};
