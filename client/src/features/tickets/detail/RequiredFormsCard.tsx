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
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  useTicketStageForms,
  type TicketStageFormBinding,
} from '@/lib/api/stageForm';
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
          const pill = statusPill(b);
          const PillIcon = pill.Icon;
          const isSubmitted = b.latestSubmission?.status === 'SUBMITTED';
          const cta = isSubmitted
            ? 'View'
            : b.latestSubmission?.status === 'IN_PROGRESS'
              ? 'Resume'
              : 'Fill';
          const isOpen = openId === b.id;

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
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {b.latestSubmission?.submittedAt
                      ? `Submitted ${new Date(b.latestSubmission.submittedAt).toLocaleString()}`
                      : 'No submission yet'}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${pill.cls}`}
                >
                  <PillIcon size={10} />
                  {pill.label}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isSubmitted && b.latestSubmission?.id) {
                      // Toggle inline read-only view instead of navigating away
                      setOpenId(isOpen ? null : b.id);
                      return;
                    }
                    const params = new URLSearchParams({
                      ticketId,
                      bindingId: b.id,
                    });
                    if (b.latestSubmission?.id) {
                      params.set('submissionId', b.latestSubmission.id);
                    }
                    navigate(`/forms/${b.formId}/fill?${params.toString()}`);
                  }}
                >
                  {isSubmitted && isOpen ? (
                    <>
                      <ChevronUp size={12} />
                      <span className="ml-1">Hide</span>
                    </>
                  ) : isSubmitted ? (
                    <>
                      <ChevronDown size={12} />
                      <span className="ml-1">{cta}</span>
                    </>
                  ) : (
                    cta
                  )}
                </Button>
              </div>
              {isOpen && isSubmitted && b.latestSubmission?.id && (
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
