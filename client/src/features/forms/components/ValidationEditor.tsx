// Per-field-type validation editor. Only renders the rules that make sense
// for the current field type so the inspector stays uncluttered.
import { Checkbox, DatePicker, Input as AntInput, InputNumber, TimePicker } from 'antd';
import dayjs from 'dayjs';
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
              <InputNumber
                value={value.minLength}
                onChange={(v) => set('minLength', v ?? undefined)}
                style={{ width: '100%' }}
                min={0}
              />
            </Row>
            <Row label="Max length">
              <InputNumber
                value={value.maxLength}
                onChange={(v) => set('maxLength', v ?? undefined)}
                style={{ width: '100%' }}
                min={0}
              />
            </Row>
          </div>
          <Row label="Regex pattern" hint="JavaScript regex without delimiters, e.g. ^[A-Z0-9]+$">
            <AntInput
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
              <InputNumber
                value={value.min}
                onChange={(v) => set('min', v ?? undefined)}
                style={{ width: '100%' }}
              />
            </Row>
            <Row label="Maximum">
              <InputNumber
                value={value.max}
                onChange={(v) => set('max', v ?? undefined)}
                style={{ width: '100%' }}
              />
            </Row>
          </div>
          <Checkbox
            checked={!!value.isInteger}
            onChange={(e) => set('isInteger', e.target.checked || undefined)}
          >
            Integer values only
          </Checkbox>
        </>
      )}

      {DATE_TYPES.has(type) && (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Earliest date">
            <DatePicker
              value={value.minDate ? dayjs(value.minDate) : null}
              onChange={(d) => set('minDate', d ? d.format('YYYY-MM-DD') : undefined)}
              style={{ width: '100%' }}
            />
          </Row>
          <Row label="Latest date">
            <DatePicker
              value={value.maxDate ? dayjs(value.maxDate) : null}
              onChange={(d) => set('maxDate', d ? d.format('YYYY-MM-DD') : undefined)}
              style={{ width: '100%' }}
            />
          </Row>
        </div>
      )}

      {TIME_TYPES.has(type) && (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Earliest time">
            <TimePicker
              value={value.minTime ? dayjs(value.minTime, 'HH:mm') : null}
              onChange={(t) => set('minTime', t ? t.format('HH:mm') : undefined)}
              format="HH:mm"
              style={{ width: '100%' }}
            />
          </Row>
          <Row label="Latest time">
            <TimePicker
              value={value.maxTime ? dayjs(value.maxTime, 'HH:mm') : null}
              onChange={(t) => set('maxTime', t ? t.format('HH:mm') : undefined)}
              format="HH:mm"
              style={{ width: '100%' }}
            />
          </Row>
        </div>
      )}

      {SELECTION_TYPES.has(type) && (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Min selections">
            <InputNumber
              value={value.minSelection}
              onChange={(v) => set('minSelection', v ?? undefined)}
              style={{ width: '100%' }}
              min={0}
            />
          </Row>
          <Row label="Max selections">
            <InputNumber
              value={value.maxSelection}
              onChange={(v) => set('maxSelection', v ?? undefined)}
              style={{ width: '100%' }}
              min={0}
            />
          </Row>
        </div>
      )}

      {FILE_TYPES.has(type) && (
        <>
          <Row label="Allowed extensions" hint="Comma-separated, no dots: pdf,jpg,png">
            <AntInput
              value={value.allowedExtensions ?? ''}
              onChange={(e) => set('allowedExtensions', e.target.value)}
              placeholder="pdf,jpg,png"
            />
          </Row>
          <Row label="Max file size (MB)">
            <InputNumber
              value={value.maxFileSizeMb}
              onChange={(v) => set('maxFileSizeMb', v ?? undefined)}
              style={{ width: '100%' }}
              min={0}
            />
          </Row>
        </>
      )}

      <Row label="Custom error message" hint="Shown instead of the default message when validation fails.">
        <AntInput.TextArea
          autoSize={{ minRows: 2, maxRows: 4 }}
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
