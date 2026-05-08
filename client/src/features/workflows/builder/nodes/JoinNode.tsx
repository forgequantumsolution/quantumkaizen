import { Handle, Position, type NodeProps } from 'reactflow';
import { Merge } from 'lucide-react';
import type { JoinNodeData } from '../builder.types';

const SOURCE_STYLE: React.CSSProperties = {
  width: 12,
  height: 12,
  background: '#fff',
  border: '2px solid #7C3AED',
};

const BRANCH_STYLE: React.CSSProperties = {
  width: 12,
  height: 12,
  background: '#7C3AED',
  border: '2px solid #fff',
};

export default function JoinNode({ data, selected }: NodeProps<JoinNodeData>) {
  const branches = Array.from({ length: data.branchCount }, (_, i) => i);

  return (
    <div
      className="rounded-lg border bg-purple-50 shadow-sm"
      style={{
        minWidth: 180,
        borderColor: selected ? '#C9A84C' : '#A78BFA',
        borderWidth: selected ? 2 : 1,
        boxShadow: selected ? '0 0 0 3px rgba(201,168,76,0.18)' : undefined,
      }}
    >
      {branches.map((i) => (
        <Handle
          key={`branch-${i}`}
          type="target"
          position={Position.Top}
          id={`branch-${i}`}
          style={{
            ...BRANCH_STYLE,
            left: `${((i + 1) * 100) / (data.branchCount + 1)}%`,
          }}
        />
      ))}

      <div className="px-3 py-2 border-b text-xs font-medium tracking-wide uppercase text-purple-700 bg-purple-100/60">
        <div className="flex items-center gap-1.5">
          <Merge size={12} />
          <span>Join — {data.joinType}</span>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-semibold text-gray-900">{data.label || 'Join'}</div>
        <div className="text-xs text-gray-500 mt-0.5">{data.branchCount} branches</div>
      </div>

      <Handle type="source" position={Position.Bottom} style={SOURCE_STYLE} />
    </div>
  );
}
