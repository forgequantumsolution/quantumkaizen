import { CircleDot, GitBranch, Merge, MousePointerClick, Plus, Split } from 'lucide-react';
import type { NodeKind } from './builder.types';

interface PaletteItem {
  kind: NodeKind;
  label: string;
  description: string;
  icon: React.ElementType;
  /** Accent colour — mirrors the node card's left-accent bar. */
  color: string;
  tint: string;
}

const ITEMS: PaletteItem[] = [
  {
    kind: 'stage',
    label: 'Stage',
    description: 'Regular workflow step',
    icon: CircleDot,
    color: '#64748B',
    tint: '#F1F5F9',
  },
  {
    kind: 'fork',
    label: 'Fork',
    description: 'Split into parallel branches',
    icon: Split,
    color: '#7C3AED',
    tint: '#F5F3FF',
  },
  {
    kind: 'join',
    label: 'Join',
    description: 'Merge parallel branches',
    icon: Merge,
    color: '#6D28D9',
    tint: '#EDE9FE',
  },
  {
    kind: 'decision',
    label: 'Decision',
    description: 'Conditional branch (XOR)',
    icon: GitBranch,
    color: '#D97706',
    tint: '#FFFBEB',
  },
];

interface Props {
  onAdd: (kind: NodeKind) => void;
}

export default function NodePalette({ onAdd }: Props) {
  return (
    <div className="h-full flex flex-col rounded-2xl border border-gray-200/80 bg-white/90 backdrop-blur shadow-sm overflow-hidden">
      <div className="px-3.5 pt-3.5 pb-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-gold-50 text-gold-600 flex items-center justify-center ring-1 ring-gold-200">
            <Plus size={14} strokeWidth={2.5} />
          </span>
          <div>
            <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider leading-none">
              Node Palette
            </h3>
            <p className="text-[10px] text-gray-400 mt-1">Building blocks</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2.5 space-y-2">
        {ITEMS.map(({ kind, label, description, icon: Icon, color, tint }) => (
          <button
            key={kind}
            onClick={() => onAdd(kind)}
            className="group relative w-full text-left rounded-xl border border-gray-200 bg-white p-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-transparent cursor-pointer overflow-hidden"
            style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
          >
            {/* Coloured left accent bar (mirrors the node card). */}
            <span
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl opacity-70 group-hover:opacity-100 transition-opacity"
              style={{ background: color }}
            />
            <div className="flex items-center gap-2.5 pl-1.5">
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                style={{ backgroundColor: tint, color }}
              >
                <Icon size={17} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                  {label}
                </div>
                <div className="text-[10.5px] text-gray-500 truncate mt-0.5">
                  {description}
                </div>
              </div>
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 opacity-0 -mr-1 translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0"
                style={{ color }}
              >
                <Plus size={16} strokeWidth={2.5} />
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="px-3 py-3 border-t border-gray-100 bg-gray-50/60">
        <div className="flex items-start gap-1.5 text-[10px] text-gray-400 leading-relaxed">
          <MousePointerClick size={13} className="shrink-0 mt-px text-gray-300" />
          <span>
            Click to add a node. Drag the gold handle between nodes to connect them.
          </span>
        </div>
      </div>
    </div>
  );
}
