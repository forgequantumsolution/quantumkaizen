// Per-field-type validation editor. Only renders the rules that make sense
// for the current field type so the inspector stays uncluttered.
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import {
  DATE_TYPES, FILE_TYPES, NUMBER_TYPES, SELECTION_TYPES, STRING_TYPES, TIME_TYPES,
  type ValidationRules,
} from '../lib/validation';

interface Props {
  type: string;
  value: ValidationRules;
  onChange: (next: ValidationRules) => void;
}

const Row = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </div>
);

export default function ValidationEditor({ type, value, onChange }: Props) {
  const set = <K extends keyof ValidationRules>(key: K, v: ValidationRules[K]) => {
    const next = { ...value };
    if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) {
      delete next[key];
    } else {
      next[key] = v;
    }
    onChange(next);
  };

  const noneApply =
    !STRING_TYPES.has(type) &&
    !NUMBER_TYPES.has(type) &&
    !DATE_TYPES.has(type) &&
    !TIME_TYPES.has(type) &&
    !SELECTION_TYPES.has(type) &&
    !FILE_TYPES.has(type);

  return (
    <div className="space-y-4">
      {STRING_TYPES.has(type) && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Min length">
              <Input
                type="number"
                value={value.minLength ?? ''}
                onChange={(e) => set('minLength', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Row>
            <Row label="Max length">
              <Input
                type="number"
                value={value.maxLength ?? ''}
                onChange={(e) => set('maxLength', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Row>
          </div>
          <Row label="Regex pattern" hint="JavaScript regex without delimiters, e.g. ^[A-Z0-9]+$">
            <Input
              value={value.pattern ?? ''}
              onChange={(e) => set('pattern', e.target.value)}
              placeholder="^[A-Z0-9]+$"
            />
          </Row>
        </>
      )}

      {NUMBER_TYPES.has(type) && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Minimum">
              <Input
                type="number"
                value={value.min ?? ''}
                onChange={(e) => set('min', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Row>
            <Row label="Maximum">
              <Input
                type="number"
                value={value.max ?? ''}
                onChange={(e) => set('max', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Row>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={!!value.isInteger}
              onChange={(e) => set('isInteger', e.target.checked || undefined)}
            />
            Integer values only
          </label>
        </>
      )}

      {DATE_TYPES.has(type) && (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Earliest date">
            <Input type="date" value={value.minDate ?? ''} onChange={(e) => set('minDate', e.target.value)} />
          </Row>
          <Row label="Latest date">
            <Input type="date" value={value.maxDate ?? ''} onChange={(e) => set('maxDate', e.target.value)} />
          </Row>
        </div>
      )}

      {TIME_TYPES.has(type) && (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Earliest time">
            <Input type="time" value={value.minTime ?? ''} onChange={(e) => set('minTime', e.target.value)} />
          </Row>
          <Row label="Latest time">
            <Input type="time" value={value.maxTime ?? ''} onChange={(e) => set('maxTime', e.target.value)} />
          </Row>
        </div>
      )}

      {SELECTION_TYPES.has(type) && (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Min selections">
            <Input
              type="number"
              value={value.minSelection ?? ''}
              onChange={(e) => set('minSelection', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </Row>
          <Row label="Max selections">
            <Input
              type="number"
              value={value.maxSelection ?? ''}
              onChange={(e) => set('maxSelection', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </Row>
        </div>
      )}

      {FILE_TYPES.has(type) && (
        <>
          <Row label="Allowed extensions" hint="Comma-separated, no dots: pdf,jpg,png">
            <Input
              value={value.allowedExtensions ?? ''}
              onChange={(e) => set('allowedExtensions', e.target.value)}
              placeholder="pdf,jpg,png"
            />
          </Row>
          <Row label="Max file size (MB)">
            <Input
              type="number"
              value={value.maxFileSizeMb ?? ''}
              onChange={(e) => set('maxFileSizeMb', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </Row>
        </>
      )}

      <Row label="Custom error message" hint="Shown instead of the default message when validation fails.">
        <Textarea
          rows={2}
          value={value.errorMessage ?? ''}
          onChange={(e) => set('errorMessage', e.target.value)}
          placeholder="e.g. Please enter a valid serial number"
        />
      </Row>

      {noneApply && (
        <p className="text-xs text-slate-400">
          This field type doesn’t support validation rules beyond Required.
        </p>
      )}
    </div>
  );
}
