import { Clock, Network, User as UserIcon, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import type { TicketSummary } from '@/lib/api/ticket';
import TicketStatusBadge from './TicketStatusBadge';

const PRIORITY_TONE: Record<string, { dot: string; chip: string }> = {
  critical: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  high: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  medium: { dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  low: { dot: 'bg-slate-400', chip: 'bg-slate-50 text-slate-600 border-slate-200' },
};

function priorityTone(name?: string | null) {
  if (!name) return null;
  return PRIORITY_TONE[name.toLowerCase()] ?? PRIORITY_TONE.low;
}

function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '').concat(parts[1]?.[0] ?? '').toUpperCase() || '?';
}

interface Props {
  ticket: TicketSummary;
  onClick: () => void;
}

export default function TicketCard({ ticket, onClick }: Props) {
  const flow = ticket.flows[0];
  const tone = priorityTone(ticket.priority?.name);

  return (
    <Card
      className={cn(
        '!p-5 group flex flex-col gap-3 cursor-pointer',
        'transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-[#C9A84C]/20',
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {ticket.uniqueId}
            </span>
            {ticket.priority && tone && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border',
                  tone.chip,
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', tone.dot)} />
                {ticket.priority.name}
              </span>
            )}
            {ticket.department && (
              <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
                {ticket.department.code}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
            {ticket.title}
          </h3>
        </div>
        <div className="shrink-0">
          <TicketStatusBadge ticket={ticket} />
        </div>
      </div>

      {flow && (
        <div className="text-xs text-gray-600 flex items-start gap-1.5 min-w-0">
          <Network size={12} className="text-gray-400 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-gray-700">{flow.workflowName}</div>
            {flow.currentStages.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {flow.currentStages.slice(0, 3).map((s) => (
                  <span
                    key={s.id}
                    className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100"
                  >
                    {s.name}
                  </span>
                ))}
                {flow.currentStages.length > 3 && (
                  <span className="text-[10px] text-gray-500 self-center">
                    +{flow.currentStages.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-xs text-gray-500 pt-2 mt-auto border-t border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          {ticket.createdBy ? (
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#C9A84C]/15 text-[10px] font-semibold text-[#8A6C18] shrink-0">
                {initials(ticket.createdBy.name)}
              </span>
              <span className="truncate max-w-[110px]">{ticket.createdBy.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <UserIcon size={12} /> Unassigned
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formatDate(ticket.updatedAt)}
          </span>
          <ChevronRight
            size={14}
            className="text-gray-300 group-hover:text-[#C9A84C] transition-colors"
          />
        </div>
      </div>
    </Card>
  );
}
