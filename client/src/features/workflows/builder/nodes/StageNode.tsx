import { CheckCircle2, CircleDot, Mail, PlayCircle } from 'lucide-react';
import type { StageNodeData } from '../builder.types';
import type { NodeComponentProps } from './types';

// Visual theme per stage state. Precedence (highest first):
// completed (green filled) > current (gold pulse) > selected (gold ring) >
// initial (green accent) > default (slate).
export default function StageNode({ data, selected }: NodeComponentProps<StageNodeData>) {
  const primary = data.primary_actions ?? [];
  const secondary = data.secondary_actions ?? [];
  const isCurrent = data.isCurrent === true;
  const isCompleted = data.isCompleted === true;

  const theme = isCompleted
    ? {
        accent: '#16A34A',
        headerText: '#15803D',
        headerBg: 'linear-gradient(135deg,#DCFCE7 0%,#F0FDF4 100%)',
        cardBg: '#F0FDF4',
        border: '#86EFAC',
        ring: '0 0 0 4px rgba(34,197,94,0.14), 0 6px 16px rgba(34,197,94,0.16)',
        label: 'Completed',
        Icon: CheckCircle2,
      }
    : isCurrent
      ? {
          accent: '#C9A84C',
          headerText: '#8A6C18',
          headerBg: 'linear-gradient(135deg,#FEF3C7 0%,#FFFBEB 100%)',
          cardBg: '#FFFDF7',
          border: '#E7CE86',
          ring: '0 0 0 6px rgba(201,168,76,0.18), 0 8px 20px rgba(201,168,76,0.24)',
          label: 'Current Stage',
          Icon: PlayCircle,
        }
      : data.is_initial_stage
        ? {
            accent: '#22C55E',
            headerText: '#16A34A',
            headerBg: 'linear-gradient(135deg,#DCFCE7 0%,#FFFFFF 100%)',
            cardBg: '#FFFFFF',
            border: '#BBF7D0',
            ring: selected ? '0 0 0 3px rgba(201,168,76,0.22)' : '0 4px 12px rgba(15,23,42,0.06)',
            label: 'Initial Stage',
            Icon: CircleDot,
          }
        : {
            accent: '#64748B',
            headerText: '#475569',
            headerBg: 'linear-gradient(135deg,#F1F5F9 0%,#FFFFFF 100%)',
            cardBg: '#FFFFFF',
            border: '#E2E8F0',
            ring: selected ? '0 0 0 3px rgba(201,168,76,0.22)' : '0 4px 12px rgba(15,23,42,0.06)',
            label: 'Stage',
            Icon: null,
          };

  const borderColor = selected && !isCompleted && !isCurrent ? '#C9A84C' : theme.border;

  return (
    <div
      className={`wf-node-card ${isCurrent && !isCompleted ? 'ticket-current-stage' : ''}`}
      style={{
        minWidth: 210,
        maxWidth: 264,
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${theme.accent}`,
        background: theme.cardBg,
        boxShadow: theme.ring,
        overflow: 'hidden',
      }}
    >
      <div
        className="px-3 py-2 text-[11px] font-semibold tracking-wide uppercase"
        style={{ color: theme.headerText, background: theme.headerBg }}
      >
        <div className="flex items-center gap-1.5">
          {theme.Icon && <theme.Icon size={13} />}
          <span>{theme.label}</span>
          {data.email_notification && <Mail size={12} className="ml-auto opacity-70" />}
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-sm font-semibold text-gray-900 truncate">
          {data.label || 'Untitled'}
        </div>
        {(primary.length > 0 || secondary.length > 0) && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {primary.map((a, i) => (
              <span
                key={`p-${i}`}
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100"
              >
                {a.stage_status_name ?? a.behavior ?? 'action'}
              </span>
            ))}
            {secondary.map((a, i) => (
              <span
                key={`s-${i}`}
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-600 border border-gray-200"
              >
                {a.stage_status_name ?? a.behavior ?? 'action'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
