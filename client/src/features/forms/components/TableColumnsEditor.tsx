// Editor for `table` field columns. Each column is a nested FormFieldDef
// stored on `field.fields` — same shape the backend already round-trips
// through FormField.parentFieldId / children. Column types are kept to the
// subset that makes sense in a row cell.
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
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
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-slate-300 hover:text-slate-500 disabled:opacity-30"
                  aria-label="Move column up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === columns.length - 1}
                  className="text-slate-300 hover:text-slate-500 disabled:opacity-30"
                  aria-label="Move column down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                className="col-span-4"
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
              <Input
                className="col-span-3"
                value={col.name}
                onChange={(e) =>
                  update(idx, {
                    name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'),
                  })
                }
              />
              <Select
                className="col-span-3"
                value={col.type ?? 'text'}
                onChange={(e) => {
                  const nextType = e.target.value;
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
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                className="col-span-1 text-slate-400 hover:text-red-500 justify-self-end"
                aria-label="Remove column"
                title="Remove column"
              >
                <Trash2 className="h-4 w-4" />
              </button>
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

      <button
        type="button"
        onClick={add}
        className="w-full mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
      >
        <Plus className="h-4 w-4" /> Add column
      </button>
    </div>
  );
}
