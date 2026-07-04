import { Split } from 'lucide-react';
import type { ForkNodeData } from '../builder.types';
import type { NodeComponentProps } from './types';

export default function ForkNode({ data, selected }: NodeComponentProps<ForkNodeData>) {
  return (
    <div
      className="wf-node-card"
      style={{
        minWidth: 188,
        borderRadius: 12,
        border: `1px solid ${selected ? '#C9A84C' : '#C4B5FD'}`,
        borderLeft: '4px solid #7C3AED',
        background: '#FBFAFF',
        boxShadow: selected
          ? '0 0 0 3px rgba(201,168,76,0.22)'
          : '0 4px 12px rgba(124,58,237,0.10)',
        overflow: 'hidden',
      }}
    >
      <div
        className="px-3 py-2 text-[11px] font-semibold tracking-wide uppercase text-purple-700"
        style={{ background: 'linear-gradient(135deg,#EDE9FE 0%,#F5F3FF 100%)' }}
      >
        <div className="flex items-center gap-1.5">
          <Split size={13} />
          <span>Fork — {data.splitType}</span>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-sm font-semibold text-gray-900">{data.label || 'Fork'}</div>
        <div className="text-xs text-purple-500/80 mt-0.5">
          {data.branchCount} parallel branches
        </div>
      </div>
    </div>
  );
}
