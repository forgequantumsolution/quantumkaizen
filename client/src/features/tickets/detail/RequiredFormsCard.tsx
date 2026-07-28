/**
 * Phase 3.5 — "Required forms" card on the ticket detail page.
 *
 * Lists every form binding on the ticket's CURRENT stage(s), with a status
 * pill (Not started / In progress / Submitted) and a "Fill" CTA that opens
 * the FormFillPage with the workflow context (ticketId + bindingId) so the
 * resulting submission gets stamped with the right FKs.
 *
 * Returns `null` when no bindings exist — keeps the ticket detail layout
 * clean on workflows that don't use forms.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Check,
  Clock,
  Circle,
  ChevronDown,
  ChevronUp,
  Lock,
  Users,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  useTicketStageForms,
  type TicketStageFormBinding,
} from '@/lib/api/stageForm';
import { formatDateTime } from '@/lib/utils';
import InlineSubmissionViewer from './InlineSubmissionViewer';

interface Props {
  ticketId: string;
}

const statusPill = (binding: TicketStageFormBinding) => {
  const s = binding.latestSubmission?.status;
  if (s === 'SUBMITTED') {
    return {
      Icon: Check,
      label: 'Submitted',
      cls: 'bg-green-100 text-green-800',
    };
  }
  if (s === 'IN_PROGRESS') {
    return {
      Icon: Clock,
      label: 'Draft saved',
      cls: 'bg-amber-100 text-amber-800',
    };
  }
  return {
    Icon: Circle,
    label: 'Not started',
    cls: 'bg-gray-100 text-gray-600',
  };
};

export default function RequiredFormsCard({ ticketId }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useTicketStageForms(ticketId);
  const [openId, setOpenId] = useState<string | null>(null);
  if (isLoading || !data) return null;
  if (data.bindings.length === 0) return null;

  return (
    <Card className="!p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ClipboardList size={14} className="text-gray-500" />
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
          Forms for this stage
        </h3>
      </div>
      <div className="space-y-1.5">
        {data.bindings.map((b) => {
          // ── No read access → locked row (still shown so a blocking required
          //    form is never invisible, but no content/actions). ──────────────
          if (!b.canRead) {
            return (
              <div
                key={b.id}
                className="rounded border border-gray-100 flex items-center gap-2 p-2 opacity-80"
              >
                <Lock size={14} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-600 truncate">
                    {b.form.title}
                    {b.isRequired && (
                      <span className="ml-1.5 text-[10px] px-1 rounded bg-amber-50 text-amber-700">
                        required
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400">No access</div>
                </div>
              </div>
            );
          }

          const pill = statusPill(b);
          const PillIcon = pill.Icon;
          const isSubmitted = b.latestSubmission?.status === 'SUBMITTED';
          const isEach = b.fillMode === 'EACH';
          const isOpen = openId === b.id;

          // EACH → the gate is per-person; "do I still owe a copy?" drives Fill.
          const owesCopy = isEach
            ? b.canFill && !b.eachProgress?.submittedByMe
            : b.canFill && !isSubmitted;
          const resumable =
            !isEach && b.canFill && b.latestSubmission?.status === 'IN_PROGRESS';
          const canViewInline = isSubmitted && !!b.latestSubmission?.id;

          const goFill = (resume: boolean) => {
            const params = new URLSearchParams({ ticketId, bindingId: b.id });
            // Only resume a draft in ANYONE mode; EACH always starts a fresh copy.
            if (resume && b.latestSubmission?.id) {
              params.set('submissionId', b.latestSubmission.id);
            }
            navigate(`/forms/${b.formId}/fill?${params.toString()}`);
          };

          return (
            <div
              key={b.id}
              className="rounded border border-gray-100 overflow-hidden"
            >
              <div className="flex items-center gap-2 p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {b.form.title}
                    {b.isRequired && (
                      <span className="ml-1.5 text-[10px] px-1 rounded bg-amber-50 text-amber-700">
                        required
                      </span>
                    )}
                    {!b.canFill && (
                      <span className="ml-1.5 text-[10px] px-1 rounded bg-gray-100 text-gray-500">
                        view only
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2">
                    {isEach && b.eachProgress ? (
                      <span className="inline-flex items-center gap-1">
                        <Users size={10} />
                        {b.eachProgress.submittedCount} of {b.eachProgress.expectedCount} submitted
                      </span>
                    ) : b.latestSubmission?.submittedAt ? (
                      `Submitted ${formatDateTime(b.latestSubmission.submittedAt)}`
                    ) : (
                      'No submission yet'
                    )}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${pill.cls}`}
                >
                  <PillIcon size={10} />
                  {pill.label}
                </span>

                {/* Fill / Resume — only when the user still owes a copy. */}
                {owesCopy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goFill(resumable)}
                  >
                    {resumable ? 'Resume' : isEach ? 'Fill your copy' : 'Fill'}
                  </Button>
                )}

                {/* View — inline read-only of the latest submitted copy. */}
                {canViewInline && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenId(isOpen ? null : b.id)}
                  >
                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    <span className="ml-1">{isOpen ? 'Hide' : 'View'}</span>
                  </Button>
                )}
              </div>
              {isOpen && canViewInline && b.latestSubmission?.id && (
                <InlineSubmissionViewer
                  formId={b.formId}
                  submissionId={b.latestSubmission.id}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
