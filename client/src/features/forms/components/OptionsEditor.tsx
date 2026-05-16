// Editable list of {label, value} options for select/radio/checkbox fields.
// Auto-derives `value` from `label` when the user hasn't customised it.
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button as AntButton, Input as AntInput } from 'antd';
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
            <AntButton
              type="text"
              size="small"
              icon={<GripVertical className="h-4 w-4" />}
              onClick={() => move(idx, -1)}
              aria-label="Move up"
            />
          </div>
          <div className="col-span-5">
            <AntInput
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
          </div>
          <div className="col-span-5">
            <AntInput
              value={String(opt.value ?? '')}
              onChange={(e) => update(idx, { value: e.target.value })}
              placeholder="value"
            />
          </div>
          <div className="col-span-1 justify-self-end">
            <AntButton
              type="text"
              danger
              size="small"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => remove(idx)}
              aria-label="Remove option"
            />
          </div>
        </div>
      ))}
      <AntButton
        type="dashed"
        block
        onClick={add}
        icon={<Plus className="h-4 w-4" />}
        style={{ marginTop: 8 }}
      >
        Add option
      </AntButton>
    </div>
  );
}
