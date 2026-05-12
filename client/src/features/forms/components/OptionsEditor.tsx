// Editable list of {label, value} options for select/radio/checkbox fields.
// Auto-derives `value` from `label` when the user hasn't customised it.
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import type { FieldOption } from '../types';

interface Props {
  value: FieldOption[];
  onChange: (next: FieldOption[]) => void;
}

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function OptionsEditor({ value, onChange }: Props) {
  const update = (idx: number, patch: Partial<FieldOption>) => {
    onChange(value.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  const add = () => {
    const n = value.length + 1;
    onChange([...value, { label: `Option ${n}`, value: `option_${n}` }]);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <span className="col-span-1" />
        <span className="col-span-5">Label</span>
        <span className="col-span-5">Value</span>
        <span className="col-span-1" />
      </div>
      {value.length === 0 && (
        <p className="text-xs text-slate-400 px-1">No options yet — add one below.</p>
      )}
      {value.map((opt, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-1 flex flex-col items-center">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              className="text-slate-300 hover:text-slate-500 leading-none"
              aria-label="Move up"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
          <Input
            className="col-span-5"
            value={opt.label}
            onChange={(e) => {
              const newLabel = e.target.value;
              const auto = slug(opt.label) === String(opt.value);
              update(idx, {
                label: newLabel,
                ...(auto ? { value: slug(newLabel) } : null),
              });
            }}
            placeholder={`Option ${idx + 1}`}
          />
          <Input
            className="col-span-5"
            value={String(opt.value ?? '')}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder="value"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="col-span-1 text-slate-400 hover:text-red-500 justify-self-end"
            aria-label="Remove option"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
      >
        <Plus className="h-4 w-4" /> Add option
      </button>
    </div>
  );
}
