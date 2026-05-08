import { Card } from '@/components/ui';
import { CircleDot, GitBranch, Merge, Split } from 'lucide-react';
import type { NodeKind } from './builder.types';

const ITEMS: { kind: NodeKind; label: string; description: string; icon: React.ElementType; color: string }[] =
  [
    { kind: 'stage', label: 'Stage', description: 'Regular workflow step', icon: CircleDot, color: '#475569' },
    { kind: 'fork', label: 'Fork', description: 'Split into parallel branches', icon: Split, color: '#7C3AED' },
    { kind: 'join', label: 'Join', description: 'Merge parallel branches', icon: Merge, color: '#7C3AED' },
    { kind: 'decision', label: 'Decision', description: 'Conditional branch (XOR)', icon: GitBranch, color: '#D97706' },
  ];

interface Props {
  onAdd: (kind: NodeKind) => void;
}

export default function NodePalette({ onAdd }: Props) {
  return (
    <Card className="!p-3">
      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 px-1">
        Node palette
      </h3>
      <div className="space-y-1.5">
        {ITEMS.map(({ kind, label, description, icon: Icon, color }) => (
          <button
            key={kind}
            onClick={() => onAdd(kind)}
            className="w-full text-left rounded-md border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all p-2 cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-7 h-7 rounded flex items-center justify-center"
                style={{ backgroundColor: `${color}15`, color }}
              >
                <Icon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-900">{label}</div>
                <div className="text-[10px] text-gray-500 truncate">{description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-3 px-1 leading-relaxed">
        Click a palette item to add it to the canvas. Drag handles between nodes to connect them.
      </p>
    </Card>
  );
}
