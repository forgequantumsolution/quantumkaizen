import { Handle, Position, type NodeProps } from 'reactflow';
import { CircleDot, Mail, PlayCircle } from 'lucide-react';
import type { StageNodeData } from '../builder.types';

const HANDLE_STYLE: React.CSSProperties = {
  width: 12,
  height: 12,
  background: '#fff',
  border: '2px solid #94A3B8',
};

export default function StageNode({ data, selected }: NodeProps<StageNodeData>) {
  const primary = data.primary_actions ?? [];
  const secondary = data.secondary_actions ?? [];
  const isCurrent = data.isCurrent === true;
  const isLR = data.flowDirection === 'LR';
  const targetPos = isLR ? Position.Left : Position.Top;
  const sourcePos = isLR ? Position.Right : Position.Bottom;

  // Precedence: isCurrent (gold pulse) > selected (gold) > initial (green) > default
  const borderColor = isCurrent
    ? '#C9A84C'
    : selected
      ? '#C9A84C'
      : data.is_initial_stage
        ? '#22C55E'
        : '#E8ECF2';
  const borderWidth = isCurrent ? 3 : selected ? 2 : 1;
  const boxShadow = isCurrent
    ? '0 0 0 6px rgba(201,168,76,0.18), 0 4px 14px rgba(201,168,76,0.25)'
    : selected
      ? '0 0 0 3px rgba(201,168,76,0.18)'
      : undefined;

  return (
    <div
      className={`rounded-lg border bg-white shadow-sm transition-all ${
        isCurrent ? 'ticket-current-stage' : ''
      }`}
      style={{
        minWidth: 200,
        maxWidth: 260,
        borderColor,
        borderWidth,
        boxShadow,
      }}
    >
      <Handle type="target" position={targetPos} style={HANDLE_STYLE} />
      <div
        className="px-3 py-2 border-b text-xs font-medium tracking-wide uppercase"
        style={{
          color: isCurrent ? '#8A6C18' : data.is_initial_stage ? '#16A34A' : '#475569',
          borderColor: '#E8ECF2',
          background: isCurrent
            ? '#FFFBEB'
            : data.is_initial_stage
              ? '#F0FDF4'
              : '#FAFAFC',
        }}
      >
        <div className="flex items-center gap-1.5">
          {isCurrent ? (
            <PlayCircle size={12} />
          ) : data.is_initial_stage ? (
            <CircleDot size={12} />
          ) : null}
          <span>
            {isCurrent ? 'Current Stage' : data.is_initial_stage ? 'Initial Stage' : 'Stage'}
          </span>
          {data.email_notification && <Mail size={12} className="ml-auto" />}
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-semibold text-gray-900 truncate">
          {data.label || 'Untitled'}
        </div>
        {(primary.length > 0 || secondary.length > 0) && (
          <div className="mt-1.5 flex gap-1 flex-wrap">
            {primary.map((a, i) => (
              <span
                key={`p-${i}`}
                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700"
              >
                {a.stage_status_name ?? a.behavior ?? 'action'}
              </span>
            ))}
            {secondary.map((a, i) => (
              <span
                key={`s-${i}`}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
              >
                {a.stage_status_name ?? a.behavior ?? 'action'}
              </span>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={sourcePos} style={HANDLE_STYLE} />
    </div>
  );
}
