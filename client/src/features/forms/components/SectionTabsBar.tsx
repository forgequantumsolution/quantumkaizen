import { Eye, Plus } from 'lucide-react';
import { isRuleConfigured } from '../lib/dependency';
import type { FormSectionDef } from '../types';

interface Props {
  sections: FormSectionDef[];
  activeIndex: number;
  onSelect: (idx: number) => void;
  onAdd: () => void;
}

export default function SectionTabsBar({
  sections, activeIndex, onSelect, onAdd,
}: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
        {sections.map((sec, idx) => {
          const active = idx === activeIndex;
          const hasLogic = isRuleConfigured(sec.dependency);
          return (
            <button
              key={sec.section_id ?? idx}
              type="button"
              onClick={() => onSelect(idx)}
              title={sec.section_name}
              className={
                'shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ' +
                (active
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300')
              }
            >
              <span
                className={
                  'text-[10px] font-mono ' +
                  (active ? 'text-indigo-400' : 'text-slate-400')
                }
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="truncate max-w-[180px]">{sec.section_name}</span>
              <span
                className={
                  'inline-flex items-center justify-center min-w-[1.25rem] h-4 rounded-full text-[10px] font-medium px-1 tabular-nums ' +
                  (active
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-500')
                }
              >
                {sec.fields.length}
              </span>
              {hasLogic && (
                <Eye className="h-3 w-3 text-violet-500" />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add section
        </button>
    </div>
  );
}
