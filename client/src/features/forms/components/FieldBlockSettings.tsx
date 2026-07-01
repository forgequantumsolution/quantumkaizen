// Tabs that live INSIDE a FieldBlock when expanded — Options / Validation /
// Logic. Tabs that don't apply for the field type are hidden so the panel
// doesn't get cluttered.
import { useState } from 'react';
import { Tabs } from 'antd';
import { fieldIsTable, fieldUsesOptions } from '../fieldCatalog';
import FieldRenderer from '../FieldRenderer';
import OptionsEditor from './OptionsEditor';
import TableColumnsEditor from './TableColumnsEditor';
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

type Tab = 'columns' | 'options' | 'rules' | 'logic';

export default function FieldBlockSettings({ field, onChange, parents }: Props) {
  const supportsOptions = fieldUsesOptions(field.type);
  const isTable = fieldIsTable(field.type);
  const tabs: { key: Tab; label: string; visible: boolean }[] = [
    { key: 'columns', label: 'Columns',    visible: isTable },
    { key: 'options', label: 'Options',    visible: supportsOptions },
    { key: 'rules',   label: 'Validation', visible: true },
    { key: 'logic',   label: 'Logic',      visible: true },
  ];
  const defaultTab: Tab = isTable ? 'columns' : supportsOptions ? 'options' : 'rules';
  const [tab, setTab] = useState<Tab>(defaultTab);

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="border-t border-slate-100 bg-slate-50/40 px-4 pt-3">
      <Tabs
        size="small"
        activeKey={tab}
        onChange={(k) => setTab(k as Tab)}
        items={visibleTabs.map((t) => ({
          key: t.key,
          label: t.label,
          children:
            t.key === 'columns' && isTable ? (
              <div className="space-y-4">
                <TableColumnsEditor
                  columns={field.fields ?? []}
                  onChange={(cols) => onChange({ fields: cols })}
                />
                {(field.fields?.length ?? 0) > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1">
                      Rows — values pre-filled when users open the form
                    </p>
                    <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                      Add rows below and fill each cell. These appear by default;
                      users can still add or remove rows when filling the form.
                    </p>
                    <FieldRenderer
                      field={field}
                      value={field.value}
                      onChange={(v) => onChange({ value: v })}
                    />
                  </div>
                )}
              </div>
            )
            : t.key === 'options' && supportsOptions ? (
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
