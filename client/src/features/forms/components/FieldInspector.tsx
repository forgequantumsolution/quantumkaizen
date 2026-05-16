// Tabbed inspector for the currently selected field. Tabs are shown only
// when relevant for the field type (e.g. Options is hidden for plain text).
import { useState } from 'react';
import { Button as AntButton, Checkbox, Input as AntInput, Select as AntSelect, Tabs } from 'antd';
import { fieldUsesOptions } from '../fieldCatalog';
import type { FormFieldDef } from '../types';
import OptionsEditor from './OptionsEditor';
import ValidationEditor from './ValidationEditor';
import DependencyEditor, { type ParentField } from './DependencyEditor';
import { emptyRule, type DependencyRule } from '../lib/dependency';
import type { ValidationRules } from '../lib/validation';

const WIDTH_OPTIONS = [
  { value: '25',  label: '25%' },
  { value: '33',  label: '33%' },
  { value: '50',  label: '50%' },
  { value: '66',  label: '66%' },
  { value: '75',  label: '75%' },
  { value: '100', label: '100%' },
];

interface Props {
  field: FormFieldDef;
  onChange: (patch: Partial<FormFieldDef>) => void;
  parents: ParentField[];
  onDelete: () => void;
}

type Tab = 'general' | 'options' | 'rules' | 'logic';

export default function FieldInspector({ field, onChange, parents, onDelete }: Props) {
  const supportsOptions = fieldUsesOptions(field.type);
  const [tab, setTab] = useState<Tab>('general');

  const tabs: { key: Tab; label: string; visible: boolean }[] = [
    { key: 'general', label: 'Field',      visible: true },
    { key: 'options', label: 'Options',    visible: supportsOptions },
    { key: 'rules',   label: 'Validation', visible: true },
    { key: 'logic',   label: 'Logic',      visible: true },
  ];

  const generalPane = (
    <div className="space-y-3">
      <Field label="Label">
        <AntInput
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Field name (key)" hint="Used as the JSON key in the response payload.">
        <AntInput
          value={field.name}
          onChange={(e) =>
            onChange({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })
          }
        />
      </Field>
      <Field label="Help text">
        <AntInput.TextArea
          autoSize={{ minRows: 2, maxRows: 6 }}
          value={(field as { helpText?: string }).helpText ?? ''}
          onChange={(e) => onChange({ helpText: e.target.value } as Partial<FormFieldDef>)}
          placeholder="Optional guidance shown under the field"
        />
      </Field>
      <Field label="Placeholder">
        <AntInput
          value={(field as { placeholder?: string }).placeholder ?? ''}
          onChange={(e) => onChange({ placeholder: e.target.value } as Partial<FormFieldDef>)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Width">
          <AntSelect
            value={field.width ?? '100'}
            onChange={(v) => onChange({ width: v })}
            options={WIDTH_OPTIONS}
            style={{ width: '100%' }}
          />
        </Field>
        <Field label="Required">
          <div className="flex items-center h-9">
            <Checkbox
              checked={!!field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
            >
              Required to fill
            </Checkbox>
          </div>
        </Field>
      </div>
    </div>
  );

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Editing field</p>
          <h3 className="text-sm font-semibold text-slate-800">{field.label}</h3>
        </div>
        <AntButton type="link" danger size="small" onClick={onDelete}>
          Delete
        </AntButton>
      </div>

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as Tab)}
        items={visibleTabs.map((t) => ({
          key: t.key,
          label: t.label,
          children:
            t.key === 'general' ? generalPane
            : t.key === 'options' ? (
                <OptionsEditor
                  value={field.options ?? []}
                  onChange={(opts) => onChange({ options: opts })}
                />
              )
            : t.key === 'rules' ? (
                <ValidationEditor
                  type={field.type ?? ''}
                  value={(field.validation ?? {}) as ValidationRules}
                  onChange={(v) => onChange({ validation: v })}
                />
              )
            : (
                <DependencyEditor
                  rule={(field.dependency as DependencyRule | undefined) ?? emptyRule()}
                  onChange={(r) => onChange({ dependency: r })}
                  parents={parents}
                />
              ),
        }))}
      />
    </div>
  );
}

const Field = ({
  label, children, hint,
}: {
  label: string; children: React.ReactNode; hint?: string;
}) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </div>
);
