// Wraps a whole section: editable name + description, settings expand
// (visibility rule), and the rendered children (FieldBlocks + AddField gaps)
// passed in via children.
import { useState } from 'react';
import { ChevronDown, Settings, Trash2, Eye } from 'lucide-react';
import Textarea from '@/components/ui/Textarea';
import DependencyEditor, { type ParentField } from './DependencyEditor';
import { emptyRule, isRuleConfigured, summariseRule, type DependencyRule } from '../lib/dependency';
import type { FormSectionDef } from '../types';

interface Props {
  section: FormSectionDef;
  index: number;
  parents: ParentField[];
  onChange: (patch: Partial<FormSectionDef>) => void;
  onDelete: () => void;
  canDelete: boolean;
  hidden?: boolean;
  children: React.ReactNode;
}

export default function SectionBlock({
  section, index, parents, onChange, onDelete, canDelete, hidden, children,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const hasLogic = isRuleConfigured(section.dependency);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/50">
      <header className="flex items-start gap-3 px-4 sm:px-6 py-4 bg-white rounded-t-2xl">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mt-1 text-slate-400 hover:text-slate-700 transition"
          title={collapsed ? 'Expand section' : 'Collapse section'}
        >
          <ChevronDown className={'h-4 w-4 transition ' + (collapsed ? '-rotate-90' : '')} />
        </button>

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
            className="block w-full text-lg font-semibold text-slate-800 bg-transparent border-0 outline-none focus:ring-2 focus:ring-indigo-200 rounded px-1 -mx-1 mt-0.5"
          />
          {!collapsed && (
            <Textarea
              rows={1}
              value={section.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Add a description (optional)"
              className="mt-1 !bg-transparent !border-0 focus:!ring-2 focus:!ring-indigo-200 !p-1 -mx-1 text-sm text-slate-500"
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={
              'h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs transition ' +
              (expanded
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-100')
            }
            title="Section visibility rule"
          >
            <Settings className="h-3.5 w-3.5" /> Logic
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500"
              title="Delete section"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

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

      {!collapsed && <div className="p-4 sm:p-6 space-y-2">{children}</div>}
    </section>
  );
}
