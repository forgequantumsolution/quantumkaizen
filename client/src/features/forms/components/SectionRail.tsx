// Left rail listing every section. Click a row to focus it in the main pane;
// the field count is shown as a small badge so users can see at a glance
// where work remains.
import { ChevronDown, ChevronUp, Eye, Plus, Trash2 } from 'lucide-react';
import { isRuleConfigured } from '../lib/dependency';
import type { FormSectionDef } from '../types';

interface Props {
  sections: FormSectionDef[];
  activeIndex: number;
  onSelect: (idx: number) => void;
  onAdd: () => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRename: (idx: number, name: string) => void;
  onDelete: (idx: number) => void;
}

export default function SectionRail({
  sections, activeIndex, onSelect, onAdd, onMove, onRename, onDelete,
}: Props) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white sticky top-20 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sections
        </h2>
        <span className="text-[11px] text-slate-400">{sections.length}</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {sections.map((sec, idx) => {
          const active = idx === activeIndex;
          const hasLogic = isRuleConfigured(sec.dependency);
          return (
            <li
              key={sec.section_id ?? idx}
              className={
                'group/row relative px-3 py-2.5 transition cursor-pointer ' +
                (active ? 'bg-indigo-50/70' : 'hover:bg-slate-50')
              }
              onClick={() => onSelect(idx)}
            >
              <div className="flex items-start gap-2">
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-500 rounded-r-full" />
                )}
                <span className="mt-1 text-[10px] font-mono text-slate-400 w-5 shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <input
                    value={sec.section_name}
                    onChange={(e) => onRename(idx, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={
                      'w-full text-sm bg-transparent border-0 outline-none truncate p-0 focus:ring-1 focus:ring-indigo-200 rounded ' +
                      (active ? 'text-indigo-900 font-semibold' : 'text-slate-700 font-medium')
                    }
                  />
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-slate-500">
                      {sec.fields.length} field{sec.fields.length === 1 ? '' : 's'}
                    </span>
                    {hasLogic && (
                      <span className="inline-flex items-center text-violet-600">
                        <Eye className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="flex flex-col gap-0.5 opacity-0 group-hover/row:opacity-100 transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onMove(idx, -1)}
                    disabled={idx === 0}
                    className="h-5 w-5 inline-flex items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                    title="Move up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onMove(idx, 1)}
                    disabled={idx === sections.length - 1}
                    className="h-5 w-5 inline-flex items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                    title="Move down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {sections.length > 1 && (
                    <button
                      onClick={() => onDelete(idx)}
                      className="h-5 w-5 inline-flex items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
                      title="Delete section"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 border-t border-slate-100 transition"
      >
        <Plus className="h-3.5 w-3.5" /> Add section
      </button>
    </aside>
  );
}
