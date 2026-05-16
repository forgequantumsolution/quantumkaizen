// Conditional visibility editor — works for both fields and sections.
// `parentScope` lists every field the rule can reference. The current field
// (when editing field-level visibility) is excluded by the caller.
import { Plus, Trash2 } from 'lucide-react';
import { Button as AntButton, Checkbox, Input as AntInput, Select as AntSelect } from 'antd';
import {
  emptyRule,
  type DependencyCondition,
  type DependencyOperator,
  type DependencyRule,
} from '../lib/dependency';

export interface ParentField {
  sectionName: string;
  fieldName: string;
  label: string;
  type: string;
  options?: { label: string; value: string | number | boolean }[];
}

interface Props {
  scopeLabel?: string; // "field" or "section"
  rule: DependencyRule;
  onChange: (next: DependencyRule) => void;
  parents: ParentField[];
}

const OPERATORS: { value: DependencyOperator; label: string; needsValue: boolean }[] = [
  { value: 'equals',       label: 'equals',         needsValue: true  },
  { value: 'not_equals',   label: 'does not equal', needsValue: true  },
  { value: 'in',           label: 'is one of',      needsValue: true  },
  { value: 'not_in',       label: 'is none of',     needsValue: true  },
  { value: 'contains',     label: 'contains text',  needsValue: true  },
  { value: 'is_empty',     label: 'is empty',       needsValue: false },
  { value: 'is_not_empty', label: 'has any value',  needsValue: false },
];

export default function DependencyEditor({ scopeLabel = 'field', rule, onChange, parents }: Props) {
  const enabled = !!rule.enabled;

  const set = (patch: Partial<DependencyRule>) =>
    onChange({ ...(rule ?? emptyRule()), ...patch });

  const updateCondition = (idx: number, patch: Partial<DependencyCondition>) => {
    set({
      conditions: rule.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });
  };

  const addCondition = () => {
    const first = parents[0];
    if (!first) return;
    set({
      enabled: true,
      conditions: [
        ...rule.conditions,
        { sectionName: first.sectionName, fieldName: first.fieldName, operator: 'equals', value: '' },
      ],
    });
  };

  const removeCondition = (idx: number) => {
    const next = rule.conditions.filter((_, i) => i !== idx);
    set({ conditions: next, enabled: next.length > 0 ? rule.enabled : false });
  };

  if (parents.length === 0) {
    return (
      <p className="text-sm text-slate-500 leading-relaxed">
        No earlier fields available. Add at least one other field above this {scopeLabel} before
        configuring visibility rules.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Checkbox
        checked={enabled}
        onChange={(e) => set({ enabled: e.target.checked })}
      >
        Conditional visibility for this {scopeLabel}
      </Checkbox>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">When</label>
              <AntSelect
                value={rule.mode}
                onChange={(v) => set({ mode: v as DependencyRule['mode'] })}
                options={[
                  { value: 'show', label: 'Show this ' + scopeLabel },
                  { value: 'hide', label: 'Hide this ' + scopeLabel },
                ]}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Match</label>
              <AntSelect
                value={rule.combinator}
                onChange={(v) => set({ combinator: v as DependencyRule['combinator'] })}
                options={[
                  { value: 'and', label: 'All conditions (AND)' },
                  { value: 'or',  label: 'Any condition (OR)' },
                ]}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {rule.conditions.map((c, idx) => {
              const parent = parents.find(
                (p) => p.fieldName === c.fieldName && p.sectionName === c.sectionName
              );
              const op = OPERATORS.find((o) => o.value === c.operator);
              return (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <AntSelect
                        value={`${c.sectionName}::${c.fieldName}`}
                        onChange={(val) => {
                          const [sectionName, fieldName] = String(val).split('::');
                          updateCondition(idx, { sectionName, fieldName, value: '' });
                        }}
                        options={parents.map((p) => ({
                          value: `${p.sectionName}::${p.fieldName}`,
                          label: `${p.label}  (${p.sectionName})`,
                        }))}
                        style={{ width: '100%' }}
                        showSearch
                        optionFilterProp="label"
                      />
                    </div>
                    <AntButton
                      type="text"
                      danger
                      size="small"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => removeCondition(idx)}
                    />
                  </div>
                  <AntSelect
                    value={c.operator}
                    onChange={(v) => updateCondition(idx, { operator: v as DependencyOperator })}
                    options={OPERATORS.map((o) => ({ value: o.value, label: o.label }))}
                    style={{ width: '100%' }}
                  />
                  {op?.needsValue &&
                    (parent?.options && parent.options.length > 0 ? (
                      c.operator === 'in' || c.operator === 'not_in' ? (
                        <AntSelect
                          mode="multiple"
                          value={(Array.isArray(c.value)
                            ? (c.value as string[])
                            : c.value
                              ? [String(c.value)]
                              : []
                          )}
                          onChange={(vals) => updateCondition(idx, { value: vals as string[] })}
                          options={parent.options.map((o) => ({
                            value: String(o.value),
                            label: o.label,
                          }))}
                          placeholder="— Pick one or more values —"
                          style={{ width: '100%' }}
                        />
                      ) : (
                        <AntSelect
                          value={c.value ? String(c.value) : undefined}
                          onChange={(v) => updateCondition(idx, { value: v })}
                          placeholder="— Pick a value —"
                          options={parent.options.map((o) => ({
                            value: String(o.value),
                            label: o.label,
                          }))}
                          style={{ width: '100%' }}
                          allowClear
                        />
                      )
                    ) : (
                      <AntInput
                        value={Array.isArray(c.value) ? c.value.join(',') : String(c.value ?? '')}
                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        placeholder="Value to match"
                      />
                    ))}
                </div>
              );
            })}
            <AntButton type="dashed" size="small" icon={<Plus className="h-4 w-4" />} onClick={addCondition}>
              Add condition
            </AntButton>
          </div>
        </>
      )}

      {!enabled && parents.length > 0 && (
        <AntButton type="dashed" size="small" icon={<Plus className="h-4 w-4" />} onClick={addCondition}>
          Add condition
        </AntButton>
      )}
    </div>
  );
}
