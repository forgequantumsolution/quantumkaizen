import { Merge } from 'lucide-react';
import type { JoinNodeData } from '../builder.types';
import type { NodeComponentProps } from './types';

export default function JoinNode({ data, selected }: NodeComponentProps<JoinNodeData>) {
  return (
    <div
      className="wf-node-card"
      style={{
        minWidth: 188,
        borderRadius: 12,
        border: `1px solid ${selected ? '#C9A84C' : '#C4B5FD'}`,
        borderLeft: '4px solid #6D28D9',
        background: '#FBFAFF',
        boxShadow: selected
          ? '0 0 0 3px rgba(201,168,76,0.22)'
          : '0 4px 12px rgba(109,40,217,0.10)',
        overflow: 'hidden',
      }}
    >
      <div
        className="px-3 py-2 text-[11px] font-semibold tracking-wide uppercase text-purple-800"
        style={{ background: 'linear-gradient(135deg,#DDD6FE 0%,#EDE9FE 100%)' }}
      >
        <div className="flex items-center gap-1.5">
          <Merge size={13} />
          <span>Join — {data.joinType}</span>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-sm font-semibold text-gray-900">{data.label || 'Join'}</div>
        <div className="text-xs text-purple-500/80 mt-0.5">
          merges {data.branchCount} branches
        </div>
      </div>
    </div>
  );
}
