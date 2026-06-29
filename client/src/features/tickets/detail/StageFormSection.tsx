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

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          title="Print this view"
        >
          <Printer size={13} />
          <span className="ml-1">Print</span>
        </Button>
      </div>

      {/* Submitted meta — only when read-only */}
      {isActiveSubmitted && (
        <div className="px-3 py-1.5 bg-emerald-50/40 text-[11px] text-gray-600 flex items-center gap-2 border-b border-gray-100">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Read-only · submitted responses</span>
          {active.latestSubmission?.submittedAt && (
            <span className="text-gray-400">
              · {new Date(active.latestSubmission.submittedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Active form */}
      <div className="px-3 py-3 bg-gray-50/30">
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
