// Tabs that live INSIDE a FieldBlock when expanded — Options / Validation /
// Logic. Tabs that don't apply for the field type are hidden so the panel
// doesn't get cluttered.
import { useState } from 'react';
import { fieldUsesOptions } from '../fieldCatalog';
import OptionsEditor from './OptionsEditor';
import ValidationEditor from './ValidationEditor';
import DependencyEditor, { type ParentField } from './DependencyEditor';
import { emptyRule, type DependencyRule } from '../lib/dependency';
import type { ValidationRules } from '../lib/validation';
import type { FormFieldDef } from '../types';

interface Props {
  field: FormFieldDef;
  onChange: (patch: Partial<FormFieldDef>) => void;
  parents: ParentField[];
}

type Tab = 'options' | 'rules' | 'logic';

export default function FieldBlockSettings({ field, onChange, parents }: Props) {
  const supportsOptions = fieldUsesOptions(field.type);
  const tabs: { key: Tab; label: string; visible: boolean }[] = [
    { key: 'options', label: 'Options',    visible: supportsOptions },
    { key: 'rules',   label: 'Validation', visible: true },
    { key: 'logic',   label: 'Logic',      visible: true },
  ];
  const [tab, setTab] = useState<Tab>(supportsOptions ? 'options' : 'rules');

  return (
    <div className="border-t border-slate-100 bg-slate-50/40">
      <div className="flex px-4 pt-3 gap-1">
        {tabs.filter((t) => t.visible).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            type="button"
            className={
              'px-3 py-1.5 text-xs rounded-md transition ' +
              (tab === t.key
                ? 'bg-white text-indigo-700 font-medium shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 pt-3">
        {tab === 'options' && supportsOptions && (
          <OptionsEditor
            value={field.options ?? []}
            onChange={(opts) => onChange({ options: opts })}
          />
        )}
        {tab === 'rules' && (
          <ValidationEditor
            type={field.type ?? ''}
            value={(field.validation ?? {}) as ValidationRules}
            onChange={(v) => onChange({ validation: v })}
          />
        )}
        {tab === 'logic' && (
          <DependencyEditor
            rule={(field.dependency as DependencyRule | undefined) ?? emptyRule()}
            onChange={(r) => onChange({ dependency: r })}
            parents={parents}
          />
        )}
      </div>
    </div>
  );
}
