import { GitBranch } from 'lucide-react';
import type { DecisionNodeData } from '../builder.types';
import type { NodeComponentProps } from './types';

export default function DecisionNode({ data, selected }: NodeComponentProps<DecisionNodeData>) {
  return (
    <div
      className="wf-node-card"
      style={{
        minWidth: 198,
        borderRadius: 12,
        border: `1px solid ${selected ? '#C9A84C' : '#FCD34D'}`,
        borderLeft: '4px solid #D97706',
        background: '#FFFDF5',
        boxShadow: selected
          ? '0 0 0 3px rgba(201,168,76,0.22)'
          : '0 4px 12px rgba(217,119,6,0.10)',
        overflow: 'hidden',
      }}
    >
      <div
        className="px-3 py-2 text-[11px] font-semibold tracking-wide uppercase text-amber-800"
        style={{ background: 'linear-gradient(135deg,#FEF3C7 0%,#FFFBEB 100%)' }}
      >
        <div className="flex items-center gap-1.5">
          <GitBranch size={13} />
          <span>Decision — XOR</span>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-sm font-semibold text-gray-900">{data.label || 'Decision'}</div>
        <div className="text-xs text-amber-600/80 mt-0.5">
          {data.branchCount} conditional paths
        </div>
      </div>
    </div>
  );
}
