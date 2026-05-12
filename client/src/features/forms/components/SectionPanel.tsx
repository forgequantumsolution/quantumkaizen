// Header card above the field table — section name, description, visibility
// rule indicator, and a "Logic" toggle to expand the dependency editor.
import { useState } from 'react';
import { Eye, Settings } from 'lucide-react';
import Textarea from '@/components/ui/Textarea';
import DependencyEditor, { type ParentField } from './DependencyEditor';
import { emptyRule, isRuleConfigured, summariseRule, type DependencyRule } from '../lib/dependency';
import type { FormSectionDef } from '../types';

interface Props {
  section: FormSectionDef;
  index: number;
  parents: ParentField[];
  onChange: (patch: Partial<FormSectionDef>) => void;
  hidden?: boolean;
}

export default function SectionPanel({
  section, index, parents, onChange, hidden,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasLogic = isRuleConfigured(section.dependency);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-3 px-4 sm:px-6 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
              Section {index + 1}
            </span>
            {hasLogic && (
              <span className="inline-flex items-center gap-1 text-[10px] text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">
                <Eye className="h-2.5 w-2.5" /> {summariseRule(section.dependency)}
              </span>
            )}
            {hidden && (
              <span className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                hidden by rule
              </span>
            )}
          </div>
          <input
            value={section.section_name}
            onChange={(e) => onChange({ section_name: e.target.value })}
            placeholder="Section name"
            className="block w-full text-xl font-semibold text-slate-900 bg-transparent border-0 outline-none focus:ring-2 focus:ring-indigo-200 rounded px-1 -mx-1 mt-0.5"
          />
          <Textarea
            rows={1}
            value={section.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Add a description (optional)"
            className="mt-1 !bg-transparent !border-0 focus:!ring-2 focus:!ring-indigo-200 !p-1 -mx-1 text-sm text-slate-500 resize-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={
            'shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-xs transition ' +
            (expanded
              ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
              : 'text-slate-500 hover:bg-slate-100')
          }
          title="Section visibility rule"
        >
          <Settings className="h-3.5 w-3.5" /> Logic
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-4 sm:px-6 py-4">
          <DependencyEditor
            scopeLabel="section"
            rule={(section.dependency as DependencyRule | undefined) ?? emptyRule()}
            onChange={(r) => onChange({ dependency: r })}
            parents={parents}
          />
        </div>
      )}
    </div>
  );
}
