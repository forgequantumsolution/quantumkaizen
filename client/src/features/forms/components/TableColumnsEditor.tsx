// Editor for `table` field columns. Each column is a nested FormFieldDef
// stored on `field.fields` — same shape the backend already round-trips
// through FormField.parentFieldId / children. Column types are kept to the
// subset that makes sense in a row cell.
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button as AntButton, Input as AntInput, Select as AntSelect } from 'antd';
import OptionsEditor from './OptionsEditor';
import { fieldUsesOptions } from '../fieldCatalog';
import type { FormFieldDef } from '../types';

const COLUMN_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
  { value: 'time',     label: 'Time' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'switch',   label: 'Switch' },
];

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

interface Props {
  columns: FormFieldDef[];
  onChange: (next: FormFieldDef[]) => void;
}

export default function TableColumnsEditor({ columns, onChange }: Props) {
  const update = (idx: number, patch: Partial<FormFieldDef>) =>
    onChange(columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => onChange(columns.filter((_, i) => i !== idx));

  const add = () => {
    const n = columns.length + 1;
    onChange([
      ...columns,
      {
        field_id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `column_${n}`,
        label: `Column ${n}`,
        type: 'text',
        required: false,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Define the columns the user will fill row-by-row. Each column captures one
        value per row.
      </p>

      <div className="grid grid-cols-12 gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <span className="col-span-1" />
        <span className="col-span-4">Label</span>
        <span className="col-span-3">Key</span>
        <span className="col-span-3">Type</span>
        <span className="col-span-1" />
      </div>

      {columns.length === 0 && (
        <p className="text-xs text-slate-400 px-1">
          No columns yet — add one below.
        </p>
      )}

      {columns.map((col, idx) => {
        const usesOptions = fieldUsesOptions(col.type);
        return (
          <div
            key={col.field_id ?? idx}
            className="rounded-lg border border-slate-200 bg-slate-50/60 p-2 space-y-2"
          >
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-1 flex flex-col items-center gap-0.5">
                <AntButton
                  type="text"
                  size="small"
                  icon={<ChevronUp className="h-3.5 w-3.5" />}
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Move column up"
                />
                <AntButton
                  type="text"
                  size="small"
                  icon={<ChevronDown className="h-3.5 w-3.5" />}
                  onClick={() => move(idx, 1)}
                  disabled={idx === columns.length - 1}
                  aria-label="Move column down"
                />
              </div>
              <div className="col-span-4">
                <AntInput
                  value={col.label}
                  placeholder={`Column ${idx + 1}`}
                  onChange={(e) => {
                    const newLabel = e.target.value;
                    const auto = slug(col.label) === col.name;
                    update(idx, {
                      label: newLabel,
                      ...(auto ? { name: slug(newLabel) || `column_${idx + 1}` } : null),
                    });
                  }}
                />
              </div>
              <div className="col-span-3">
                <AntInput
                  value={col.name}
                  onChange={(e) =>
                    update(idx, {
                      name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'),
                    })
                  }
                />
              </div>
              <div className="col-span-3">
                <AntSelect
                  value={col.type ?? 'text'}
                  onChange={(nextType) => {
                    const patch: Partial<FormFieldDef> = { type: nextType };
                    if (fieldUsesOptions(nextType) && !col.options) {
                      patch.options = [
                        { label: 'Option 1', value: 'option_1' },
                        { label: 'Option 2', value: 'option_2' },
                      ];
                    } else if (!fieldUsesOptions(nextType) && col.options) {
                      patch.options = undefined;
                    }
                    update(idx, patch);
                  }}
                  options={COLUMN_TYPES}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="col-span-1 justify-self-end">
                <AntButton
                  type="text"
                  danger
                  size="small"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => remove(idx)}
                  aria-label="Remove column"
                  title="Remove column"
                />
              </div>
            </div>

            {usesOptions && (
              <div className="bg-white border border-slate-200 rounded-md p-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1.5">
                  Options for this column
                </p>
                <OptionsEditor
                  value={col.options ?? []}
                  onChange={(opts) => update(idx, { options: opts })}
                />
              </div>
            )}
          </div>
        );
      })}

      <AntButton
        type="dashed"
        block
        onClick={add}
        icon={<Plus className="h-4 w-4" />}
        style={{ marginTop: 8 }}
      >
        Add column
      </AntButton>
    </div>
  );
}
