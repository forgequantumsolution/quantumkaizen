import { CircleDot, Timer, AlertTriangle, Workflow as WorkflowIcon } from 'lucide-react';
import { useTicketSla, type SlaTimerWithEvents } from '@/lib/api/sla';
import { useCountdown } from '@/hooks/useCountdown';

interface Props {
  ticketId: string;
  currentStages: Array<{ id: string; name: string }>;
  isCompleted: boolean;
  isOnHold: boolean;
  onOpenWorkflow: () => void;
  onOpenSla: () => void;
}

export default function StageStripBar({
  ticketId,
  currentStages,
  isCompleted,
  isOnHold,
  onOpenWorkflow,
  onOpenSla,
}: Props) {
  const { data: slaData } = useTicketSla(ticketId);
  const activeTimer = pickActiveTimer(slaData?.timers ?? []);

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <StageChip
        isCompleted={isCompleted}
        isOnHold={isOnHold}
        currentStages={currentStages}
      />

      {activeTimer && (
        <>
          <span className="text-gray-200">·</span>
          <SlaMini timer={activeTimer} onClick={onOpenSla} />
        </>
      )}

      <button
        type="button"
        onClick={onOpenWorkflow}
        className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-[#8A6C18] hover:text-[#5C4A0F] hover:bg-[#C9A84C]/10 px-2 py-1 rounded-md transition-colors"
      >
        <WorkflowIcon size={13} />
        View workflow
      </button>
    </div>
  );
}

interface StageChipProps {
  isCompleted: boolean;
  isOnHold: boolean;
  currentStages: Array<{ id: string; name: string }>;
}

function StageChip({ isCompleted, isOnHold, currentStages }: StageChipProps) {
  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Completed
      </span>
    );
  }
  if (isOnHold) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
        On hold
      </span>
    );
  }
  if (currentStages.length === 0) {
    return <span className="text-sm text-gray-500">No active stage</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 min-w-0">
      <CircleDot size={13} className="text-[#8A6C18] shrink-0" />
      <span className="text-[11px] uppercase tracking-wide text-[#8A6C18] font-semibold shrink-0">
        Current
      </span>
      <span className="flex gap-1 flex-wrap min-w-0">
        {currentStages.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5C4A0F] bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-2 py-0.5 rounded-full truncate"
          >
            {s.name}
          </span>
        ))}
      </span>
    </span>
  );
}

interface SlaMiniProps {
  timer: SlaTimerWithEvents;
  onClick: () => void;
}

function SlaMini({ timer, onClick }: SlaMiniProps) {
  const countdown = useCountdown(timer.deadline);
  const breached = timer.status === 'BREACHED' || (countdown?.isBreached ?? false);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors ${
        breached
          ? 'text-red-700 bg-red-50 hover:bg-red-100'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
      title={`SLA — ${timer.stage.name}`}
    >
      {breached ? <AlertTriangle size={12} /> : <Timer size={12} />}
      <span className="font-mono">{countdown?.formatted ?? '—'}</span>
    </button>
  );
}

function pickActiveTimer(
  timers: SlaTimerWithEvents[],
): SlaTimerWithEvents | null {
  const active = timers.filter(
    (t) => t.status === 'RUNNING' || t.status === 'PAUSED' || t.status === 'EXTENDED',
  );
  if (active.length > 0) return active[0] ?? null;
  return timers.length > 0 ? timers[timers.length - 1] ?? null : null;
}
