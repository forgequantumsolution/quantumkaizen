import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Lock } from 'lucide-react';
import { Card } from '@/components/ui';
import {
  useTicketStageForms,
  type TicketStageFormBinding,
} from '@/lib/api/stageForm';
import { useSubmission } from '@/features/forms/hooks';
import FormFillEmbed from '@/features/forms/FormFillEmbed';
import { formatDateTime } from '@/lib/utils';

interface Props {
  ticketId: string;
  /** The ticket's own Priority name (e.g. "Low"/"Critical") — used only to flag
   *  a contradiction against this stage's Risk/Regulatory answers, if present. */
  ticketPriorityName?: string | null;
}

/**
 * Cross-checks a submitted form's "Risk to Patient/Product" and "Regulatory
 * Reportable" answers (present on the CAPA Initiation form, and reused on a
 * couple of others) against the ticket's Priority, so a "Low" priority sitting
 * next to a regulatory-reportable or high-risk answer gets a second look
 * instead of sailing through unnoticed.
 */
function usePriorityContradiction(
  responses: Record<string, Record<string, unknown>> | undefined,
  priorityName: string | null | undefined,
) {
  return useMemo(() => {
    if (!responses) return null;
    const flat: Record<string, unknown> = {};
    for (const section of Object.values(responses)) {
      Object.assign(flat, section);
    }
    const hasRisk = 'risk_to_patient_product' in flat || 'regulatory_reportable' in flat;
    if (!hasRisk) return null;

    const regulatoryReportable = flat.regulatory_reportable === 'yes';
    const highPatientRisk = flat.risk_to_patient_product === 'high';
    const priority = (priorityName ?? '').toLowerCase();
    const lowOrUnset = !priority || priority === 'low';

    if (lowOrUnset && (regulatoryReportable || highPatientRisk)) {
      const reasons = [
        regulatoryReportable && 'marked Regulatory Reportable',
        highPatientRisk && 'Risk to Patient/Product is High',
      ].filter(Boolean);
      return `This record is ${reasons.join(' and ')}, but Priority is ${
        priority ? `set to "${priorityName}"` : 'not set'
      }. Worth a second look before this moves on.`;
    }
    return null;
  }, [responses, priorityName]);
}

export default function StageFormSection({ ticketId, ticketPriorityName }: Props) {
  const { data, isLoading } = useTicketStageForms(ticketId);
  // Only forms the current user may READ are surfaced with content. Forms they're
  // not in the fill/view group for are shown as a locked notice (no title, no
  // content — the backend also nulls their submission payload) so the user knows
  // a form exists but isn't left staring at an empty panel. View-only forms
  // (canRead && !canFill) are kept but rendered read-only below.
  const bindings = useMemo(
    () => (data?.bindings ?? []).filter((b) => b.canRead),
    [data],
  );
  const totalCount = data?.bindings?.length ?? 0;
  const restrictedCount = totalCount - bindings.length;

  const [activeBindingId, setActiveBindingId] = useState<string | null>(null);

  useEffect(() => {
    if (bindings.length === 0) {
      setActiveBindingId(null);
      return;
    }
    if (activeBindingId && bindings.some((b) => b.id === activeBindingId)) return;
    const firstPending = bindings.find(
      (b) => b.latestSubmission?.status !== 'SUBMITTED',
    );
    setActiveBindingId((firstPending ?? bindings[0])!.id);
  }, [bindings, activeBindingId]);

  const activeForContradictionCheck = bindings.find((b) => b.id === activeBindingId) ?? bindings[0];
  const activeSubmissionId =
    activeForContradictionCheck?.latestSubmission?.status === 'SUBMITTED'
      ? activeForContradictionCheck.latestSubmission.id
      : undefined;
  const { data: activeSubmissionDetail } = useSubmission(activeSubmissionId);
  const priorityContradiction = usePriorityContradiction(
    activeSubmissionDetail?.responses,
    ticketPriorityName,
  );

  if (isLoading) {
    return (
      <Card className="!p-4">
        <div className="text-xs text-gray-400">Loading forms…</div>
      </Card>
    );
  }

  // No forms on this stage at all → render nothing.
  if (totalCount === 0) {
    return null;
  }

  // There are forms on this stage, but the user can read none of them → show a
  // clear "restricted" notice instead of a blank space. No form title is leaked.
  if (bindings.length === 0) {
    return (
      <Card className="!p-4">
        <div className="flex items-start gap-2.5 text-[13px] text-gray-600">
          <Lock size={15} className="mt-0.5 shrink-0 text-gray-400" />
          <span>
            {restrictedCount === 1
              ? 'This stage has a form restricted to other users — you don’t have permission to view or fill it.'
              : `This stage has ${restrictedCount} forms restricted to other users — you don’t have permission to view or fill them.`}{' '}
            Someone with access will complete {restrictedCount === 1 ? 'it' : 'them'}.
          </span>
        </div>
      </Card>
    );
  }

  const active = bindings.find((b) => b.id === activeBindingId) ?? bindings[0]!;
  const totalBindings = bindings.length;
  const doneBindings = bindings.filter(
    (b) => b.latestSubmission?.status === 'SUBMITTED',
  ).length;
  const overallPct = totalBindings === 0
    ? 0
    : Math.round((doneBindings / totalBindings) * 100);

  const isActiveSubmitted = active.latestSubmission?.status === 'SUBMITTED';
  // A user with view access but not fill access sees the form read-only, just
  // like an already-submitted form — they can never enter or submit responses.
  const isViewOnly = !active.canFill;
  const readOnly = isActiveSubmitted || isViewOnly;

  return (
    <Card noPadding className="overflow-hidden">
      {/* Compact header row: chips + progress + meta + print, all on one line */}
      <div className="px-3 py-2 flex items-center gap-3 flex-wrap border-b border-gray-100">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {bindings.map((b, idx) => (
            <BindingChip
              key={b.id}
              binding={b}
              index={idx + 1}
              active={b.id === active.id}
              onClick={() => setActiveBindingId(b.id)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto min-w-[200px] flex-1 max-w-[360px]">
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-gray-700 whitespace-nowrap">
            {doneBindings}/{totalBindings} · {overallPct}%
          </span>
        </div>
      </div>

      {/* Read-only banner — submitted responses, or view-only access */}
      {readOnly && (
        <div className="px-3 py-1.5 bg-emerald-50/40 text-[11px] text-gray-600 flex items-center gap-2 border-b border-gray-100">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>
            {isActiveSubmitted
              ? 'Read-only · submitted responses'
              : 'Read-only · view access (you cannot fill this form)'}
          </span>
          {isActiveSubmitted && active.latestSubmission?.submittedAt && (
            <span className="text-gray-400">
              · {formatDateTime(active.latestSubmission.submittedAt)}
            </span>
          )}
        </div>
      )}

      {/* Priority vs. Risk/Regulatory contradiction — informational, not a
          submit gate; the generic form runtime has no cross-field hook to
          block on, so this surfaces alongside the submitted answers instead. */}
      {isActiveSubmitted && priorityContradiction && (
        <div className="px-3 py-2 bg-amber-50 text-[12px] text-amber-800 flex items-start gap-2 border-b border-amber-100">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{priorityContradiction}</span>
        </div>
      )}

      {/* Active form */}
      <div className="px-3 py-3 bg-gray-50/30">
        <FormFillEmbed
          key={`${active.id}::${active.latestSubmission?.id ?? 'new'}::${
            readOnly ? 'ro' : 'rw'
          }`}
          formId={active.formId}
          workflowCtx={{ ticketId, bindingId: active.id }}
          submissionId={active.latestSubmission?.id ?? null}
          readOnly={readOnly}
          variant="inline"
          onSubmitted={(status) => {
            // On submit, auto-advance to the next unfinished checklist so the
            // user isn't left on the just-completed (now read-only) form waiting
            // for a manual reload. Computed from the current order (treating the
            // just-submitted form as done); if none remain we stay put.
            if (status !== 'SUBMITTED') return;
            const next = bindings.find(
              (b) =>
                b.id !== active.id &&
                b.latestSubmission?.status !== 'SUBMITTED',
            );
            if (next) setActiveBindingId(next.id);
          }}
        />
      </div>

      {/* Mixed case: some forms on this stage are restricted from this user. */}
      {restrictedCount > 0 && (
        <div className="px-3 py-1.5 text-[11px] text-gray-500 border-t border-gray-100 flex items-center gap-1.5">
          <Lock size={12} className="text-gray-400 shrink-0" />
          <span>
            {restrictedCount === 1
              ? '1 more form on this stage is restricted to other users.'
              : `${restrictedCount} more forms on this stage are restricted to other users.`}
          </span>
        </div>
      )}
    </Card>
  );
}

interface BindingChipProps {
  binding: TicketStageFormBinding;
  index: number;
  active: boolean;
  onClick: () => void;
}

function BindingChip({ binding, index, active, onClick }: BindingChipProps) {
  const submitted = binding.latestSubmission?.status === 'SUBMITTED';
  const inProgress = binding.latestSubmission?.status === 'IN_PROGRESS';

  const ringCls = active
    ? submitted
      ? 'ring-2 ring-emerald-300'
      : 'ring-2 ring-blue-300'
    : '';
  const baseCls = submitted
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
    : inProgress
      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
      : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 max-w-[220px] px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${baseCls} ${ringCls}`}
      title={binding.form.title}
    >
      <span
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold ${
          submitted
            ? 'bg-emerald-500 text-white'
            : inProgress
              ? 'bg-amber-500 text-white'
              : 'bg-blue-500 text-white'
        }`}
      >
        {submitted ? <CheckCircle2 size={10} /> : <span>{index}</span>}
      </span>
      <span className="truncate flex items-center gap-1">
        {!submitted && !inProgress && <ClipboardList size={11} className="text-blue-500" />}
        {binding.form.title}
      </span>
    </button>
  );
}
