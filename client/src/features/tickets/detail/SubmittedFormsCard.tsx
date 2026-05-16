/**
 * Lists every FormSubmission row that has been filled against the ticket —
 * regardless of which stage the ticket is on now. This complements
 * RequiredFormsCard (which only shows bindings for the CURRENT stage) so that
 * earlier-stage submissions remain visible after the ticket has moved on.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Check,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Pencil,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useSubmissions } from '@/features/forms/hooks';
import type { SubmissionListItem } from '@/features/forms/types';
import InlineSubmissionViewer from './InlineSubmissionViewer';

interface Props {
  ticketId: string;
}

const statusPill = (s: SubmissionListItem) => {
  if (s.status === 'SUBMITTED' || s.status === 'APPROVED') {
    return {
      Icon: Check,
      label: s.status === 'APPROVED' ? 'Approved' : 'Submitted',
      cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    };
  }
  if (s.status === 'IN_PROGRESS') {
    return {
      Icon: Clock,
      label: 'Draft saved',
      cls: 'bg-amber-50 text-amber-700 border border-amber-200',
    };
  }
  return {
    Icon: ClipboardCheck,
    label: 'Rejected',
    cls: 'bg-rose-50 text-rose-700 border border-rose-200',
  };
};

export default function SubmittedFormsCard({ ticketId }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useSubmissions({ ticket_id: ticketId, page_size: 100 });
  const [openId, setOpenId] = useState<string | null>(null);

  // Group submissions: latest first, deduped by (formId, stageId) so we don't
  // show every draft revision — just the most recent state per binding.
  const items = useMemo(() => {
    const list = data?.items ?? [];
    const seen = new Set<string>();
    const grouped: SubmissionListItem[] = [];
    for (const s of [...list].sort(
      (a, b) =>
        new Date(b.submittedAt ?? b.createdAt).getTime() -
        new Date(a.submittedAt ?? a.createdAt).getTime(),
    )) {
      const key = `${s.formId}::${s.stageId ?? '_'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      grouped.push(s);
    }
    return grouped;
  }, [data?.items]);

  if (isLoading) return null;
  if (items.length === 0) return null;

  const submittedCount = items.filter(
    (s) => s.status === 'SUBMITTED' || s.status === 'APPROVED',
  ).length;

  return (
    <Card noPadding className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={14} className="text-emerald-600" />
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Filled forms
          </h3>
        </div>
        <span className="text-[11px] text-gray-500">
          {submittedCount} submitted · {items.length} total
        </span>
      </div>
      <ul className="divide-y divide-gray-100">
        {items.map((s) => {
          const pill = statusPill(s);
          const PillIcon = pill.Icon;
          const isOpen = openId === s.id;
          const isReadOnly = s.status === 'SUBMITTED' || s.status === 'APPROVED';
          return (
            <li key={s.id} className="border-0">
              <div
                className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                  isOpen ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setOpenId(isOpen ? null : s.id)}
              >
                <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {s.form.title}
                    <span className="ml-1.5 text-[10px] text-gray-400 font-normal">
                      v{s.form.version}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-1.5 flex-wrap">
                    {s.stage && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                        {s.stage.name}
                      </span>
                    )}
                    {s.submittedBy && <span>by {s.submittedBy.name}</span>}
                    {s.submittedAt && (
                      <span className="text-gray-400">
                        · {new Date(s.submittedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${pill.cls}`}
                >
                  <PillIcon size={10} />
                  {pill.label}
                </span>
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const params = new URLSearchParams({
                        ticketId,
                        submissionId: s.id,
                      });
                      if (s.bindingId) params.set('bindingId', s.bindingId);
                      navigate(`/forms/${s.formId}/fill?${params.toString()}`);
                    }}
                    title="Continue editing"
                  >
                    <Pencil size={12} />
                  </Button>
                )}
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-700 p-1"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
              {isOpen && (
                <InlineSubmissionViewer formId={s.formId} submissionId={s.id} />
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
