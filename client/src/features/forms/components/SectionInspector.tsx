// Inspector for a section: name, optional description, dependency rule.
import { Button as AntButton, Input as AntInput } from 'antd';
import DependencyEditor, { type ParentField } from './DependencyEditor';
import { emptyRule, type DependencyRule } from '../lib/dependency';
import type { FormSectionDef } from '../types';

interface Props {
  section: FormSectionDef;
  onChange: (patch: Partial<FormSectionDef>) => void;
  parents: ParentField[];
  onDelete: () => void;
  canDelete: boolean;
}

export default function SectionInspector({ section, onChange, parents, onDelete, canDelete }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Editing section</p>
          <h3 className="text-sm font-semibold text-slate-800">{section.section_name}</h3>
        </div>
        {canDelete && (
          <AntButton type="link" danger size="small" onClick={onDelete}>
            Delete
          </AntButton>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Section name</label>
        <AntInput
          value={section.section_name}
          onChange={(e) => onChange({ section_name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <AntInput.TextArea
          autoSize={{ minRows: 2, maxRows: 6 }}
          value={(section as { description?: string }).description ?? ''}
          onChange={(e) =>
            onChange({ description: e.target.value } as Partial<FormSectionDef>)
          }
          placeholder="Optional context shown above the section."
        />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Visibility
        </h4>
        <DependencyEditor
          scopeLabel="section"
          rule={(section.dependency as DependencyRule | undefined) ?? emptyRule()}
          onChange={(r) => onChange({ dependency: r })}
          parents={parents}
        />
      </div>
    </div>
  );
}
