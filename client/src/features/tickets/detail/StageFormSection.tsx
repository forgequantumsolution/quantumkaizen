import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Printer } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  useTicketStageForms,
  type TicketStageFormBinding,
} from '@/lib/api/stageForm';
import FormFillEmbed from '@/features/forms/FormFillEmbed';

interface Props {
  ticketId: string;
}

export default function StageFormSection({ ticketId }: Props) {
  const { data, isLoading } = useTicketStageForms(ticketId);
  const bindings = useMemo(() => data?.bindings ?? [], [data]);

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

  if (isLoading) {
    return (
      <Card className="!p-4">
        <div className="text-xs text-gray-400">Loading forms…</div>
      </Card>
    );
  }

  if (bindings.length === 0) {
    return null;
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

  return (
    <Card noPadding className="overflow-hidden">
      {/* Form-binding chip selector + Print */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          title="Print this view"
        >
          <Printer size={14} />
          <span className="ml-1.5">Print</span>
        </Button>
      </div>

      {/* Section progress */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
          <span>
            <span className="font-semibold text-gray-700">
              {doneBindings} of {totalBindings}
            </span>{' '}
            section{totalBindings === 1 ? '' : 's'} completed
          </span>
          <span className="font-semibold text-gray-700">{overallPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Active form */}
      <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-4">
        {isActiveSubmitted && (
          <div className="mb-3 text-[11px] text-gray-500 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Read-only view of submitted responses
            {active.latestSubmission?.submittedAt && (
              <span className="text-gray-400">
                · submitted {new Date(active.latestSubmission.submittedAt).toLocaleString()}
              </span>
            )}
          </div>
        )}
        <FormFillEmbed
          key={`${active.id}::${active.latestSubmission?.id ?? 'new'}::${
            isActiveSubmitted ? 'ro' : 'rw'
          }`}
          formId={active.formId}
          workflowCtx={{ ticketId, bindingId: active.id }}
          submissionId={active.latestSubmission?.id ?? null}
          readOnly={isActiveSubmitted}
          variant="inline"
        />
      </div>
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
      className={`inline-flex items-center gap-2 max-w-[260px] px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${baseCls} ${ringCls}`}
      title={binding.form.title}
    >
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold ${
          submitted
            ? 'bg-emerald-500 text-white'
            : inProgress
              ? 'bg-amber-500 text-white'
              : 'bg-blue-500 text-white'
        }`}
      >
        {submitted ? <CheckCircle2 size={12} /> : <span>{index}</span>}
      </span>
      <span className="truncate flex items-center gap-1">
        {!submitted && !inProgress && <ClipboardList size={12} className="text-blue-500" />}
        {binding.form.title}
      </span>
    </button>
  );
}
