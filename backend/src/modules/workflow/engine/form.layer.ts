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

  // Each stage entry is a fresh fill opportunity. After a RETURN the ticket
  // re-opens a tracking row with a new `enteredAt`; older submissions belonged
  // to the previous visit and must not satisfy the current one.
  const activeTracking = await tx.ticketStageTracking.findFirst({
    where: { ticketId, stageId, isActive: true },
    orderBy: { enteredAt: 'desc' },
    select: { enteredAt: true },
  });
  const since = activeTracking?.enteredAt ?? new Date(0);

  const submittedFormIds = await tx.formSubmission
    .findMany({
      where: {
        ticketId,
        stageId,
        status: 'SUBMITTED',
        submittedAt: { gte: since },
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
