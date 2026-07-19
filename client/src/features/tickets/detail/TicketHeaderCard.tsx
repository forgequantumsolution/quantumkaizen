import { useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Zap,
  Workflow as WorkflowIcon,
  Activity as ActivityIcon,
  Info,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useTicketSla } from '@/lib/api/sla';
import { useCountdown } from '@/hooks/useCountdown';
import { useTicketStageForms } from '@/lib/api/stageForm';
import { formatDateTime } from '@/lib/utils';
import TicketStatusBadge from '../shared/TicketStatusBadge';
import DownloadReportButton from '../report/DownloadReportButton';
import type { TicketDetail } from '@/lib/api/ticket';

interface Props {
  ticket: TicketDetail;
  onOpenWorkflow: () => void;
  onOpenActivity: () => void;
  onOpenDetails: () => void;
  onBack: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  isDeleting: boolean;
}

export default function TicketHeaderCard({
  ticket,
  onOpenWorkflow,
  onOpenActivity,
  onOpenDetails,
  onBack,
  onDelete,
  canDelete,
  isDeleting,
}: Props) {
  const flow = ticket.flows[0];
  const isCompleted = !!flow?.isCompleted;

  const { data: slaData } = useTicketSla(ticket.id);
  const activeSla = useMemo(() => {
    const timers = slaData?.timers ?? [];
    return (
      timers.find(
        (t) => t.status === 'RUNNING' || t.status === 'PAUSED' || t.status === 'EXTENDED',
      ) ?? null
    );
  }, [slaData]);
  const countdown = useCountdown(activeSla?.deadline ?? null);
  const slaBreached = activeSla?.status === 'BREACHED' || countdown?.isBreached === true;

  const { data: stageFormsData } = useTicketStageForms(ticket.id);
  const stageProgress = useMemo(() => {
    const bindings = stageFormsData?.bindings ?? [];
    const required = bindings.filter((b) => b.isRequired);
    const denom = required.length > 0 ? required.length : bindings.length;
    if (denom === 0) return { done: 0, total: 0, pct: 0 };
    const pool = required.length > 0 ? required : bindings;
    const done = pool.filter((b) => b.latestSubmission?.status === 'SUBMITTED').length;
    return { done, total: denom, pct: Math.round((done / denom) * 100) };
  }, [stageFormsData]);

  const currentStageName =
    flow?.currentStages.map((s) => s.name).join(', ') ||
    (isCompleted ? 'Completed' : '—');

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Row 1 — title, SLA, actions, back */}
      <div className="px-4 sm:px-5 py-3 flex items-center gap-3 flex-wrap">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <CheckCircle2
            size={20}
            className={isCompleted ? 'text-emerald-500' : 'text-gray-400'}
          />
          <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate min-w-0">
            {ticket.title}
          </h1>
        </div>

        {activeSla && (
          <button
            type="button"
            onClick={onOpenActivity}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              slaBreached
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100'
            }`}
            title="SLA timer"
          >
            <Clock
              size={14}
              className={slaBreached ? 'text-red-500' : 'text-emerald-600'}
            />
            <span className="text-gray-700">SLA Deadline:</span>
            <span className={slaBreached ? 'text-red-700' : 'text-emerald-700'}>
              {formatDateTime(activeSla.deadline)}
            </span>
            <span
              className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                slaBreached
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-white text-emerald-700 border border-emerald-300'
              }`}
            >
              {slaBreached ? 'Breached' : 'On Time'}
            </span>
          </button>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <IconButton
            label="Ticket details"
            onClick={onOpenDetails}
            icon={<Info size={15} />}
            tone="muted"
          />
          {flow && (
            <IconButton
              label="View workflow"
              onClick={onOpenWorkflow}
              icon={<WorkflowIcon size={15} />}
              tone="primary"
            />
          )}
          <IconButton
            label="Activity"
            onClick={onOpenActivity}
            icon={<ActivityIcon size={15} />}
            tone="muted"
          />
          <TicketStatusBadge ticket={ticket} />
          <DownloadReportButton ticketId={ticket.id} ticketUniqueId={ticket.uniqueId} />
          <Button variant="outline" size="sm" onClick={onBack}>
            Back
          </Button>
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              isLoading={isDeleting}
              disabled={isDeleting}
              title="Delete ticket"
            >
              <Trash2 size={14} className="text-red-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Row 2 — pills + stage progress */}
      <div className="px-4 sm:px-5 pb-3 flex items-center gap-2 flex-wrap">
        <Pill
          icon={<Clock size={12} className="text-teal-600" />}
          label="Initiated At:"
          value={formatDateTime(ticket.createdAt)}
          tone="teal"
        />
        {flow && (
          <Pill
            icon={<Zap size={12} className="text-blue-600" />}
            label="Current Stage:"
            value={currentStageName}
            tone="blue"
          />
        )}

        {stageProgress.total > 0 && (
          <div className="ml-auto flex items-center gap-2 min-w-[180px]">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Stage Progress
            </span>
            <span className="text-xs font-semibold text-gray-700">
              {stageProgress.done}/{stageProgress.total}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden min-w-[80px]">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${stageProgress.pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700">
              {stageProgress.pct}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface PillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'teal' | 'blue';
}

function Pill({ icon, label, value, tone }: PillProps) {
  const toneCls =
    tone === 'teal'
      ? 'border-teal-200 bg-teal-50/70 text-teal-900'
      : 'border-blue-200 bg-blue-50/70 text-blue-900';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-2.5 py-1 rounded-lg border ${toneCls}`}
    >
      {icon}
      <span className="opacity-80">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone: 'primary' | 'muted';
}

function IconButton({ label, onClick, icon, tone }: IconButtonProps) {
  const cls =
    tone === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${cls}`}
    >
      {icon}
    </button>
  );
}
