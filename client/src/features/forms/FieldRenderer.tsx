// Renders any built-in field type using Ant Design components. Used by both
// the builder canvas (disabled preview) and the fill page (interactive). All
// state goes through `value` / `onChange` so the parent owns the data — antd's
// Dayjs objects are converted to strings on the way out.
import { useId } from 'react';
import {
  Input, InputNumber, Select, DatePicker, TimePicker, Checkbox, Radio, Switch,
  Slider, ColorPicker, Upload, Button, Table as AntTable,
} from 'antd';
import {
  Plus, Trash2, Upload as UploadIcon, Image as ImageIcon, PenLine,
} from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import { fieldIsTable } from './fieldCatalog';
import type { FormFieldDef, FieldOption } from './types';

const { TextArea, Password } = Input;
const { RangePicker: DateRangePicker } = DatePicker;
const { RangePicker: TimeRangePicker } = TimePicker;

interface Props {
  field: FormFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}

const dateValue = (v: unknown): Dayjs | null => {
  if (!v) return null;
  const d = dayjs(v as string);
  return d.isValid() ? d : null;
};

// Cell renderer for a single column of a table field. Mirrors the main field
// renderer but only for the types the column editor exposes.
const renderCell = (
  col: FormFieldDef,
  cellValue: unknown,
  onChange: (v: unknown) => void,
  disabled?: boolean,
) => {
  const opts: FieldOption[] = col.options ?? [];
  switch (col.type) {
    case 'number':
      return (
        <InputNumber
          size="small"
          value={cellValue as number | null | undefined}
          onChange={(v) => onChange(v ?? null)}
          disabled={disabled}
          className="!w-full"
        />
      );
    case 'date':
      return (
        <DatePicker
          size="small"
          value={dateValue(cellValue)}
          onChange={(d) => onChange(d ? d.format('YYYY-MM-DD') : null)}
          disabled={disabled}
          className="!w-full"
        />
      );
    case 'time':
      return (
        <TimePicker
          size="small"
          value={dateValue(cellValue ? `2000-01-01T${cellValue as string}` : null)}
          onChange={(d) => onChange(d ? d.format('HH:mm') : null)}
          disabled={disabled}
          format="HH:mm"
          className="!w-full"
        />
      );
    case 'select':
      return (
        <Select
          size="small"
          value={(cellValue as string | number | undefined) ?? undefined}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          allowClear
          options={opts.map((o) => ({ value: o.value, label: o.label }))}
          className="!w-full"
        />
      );
    case 'checkbox':
      return (
        <Checkbox
          checked={!!cellValue}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
      );
    case 'switch':
      return (
        <Switch
          size="small"
          checked={!!cellValue}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      );
    case 'text':
    default:
      return (
        <Input
          size="small"
          value={String(cellValue ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
  }
};

export default function FieldRenderer({ field, value, onChange, disabled }: Props) {
  const id = useId();
  const type = field.type ?? '';
  const placeholder = (field as { placeholder?: string }).placeholder;
  const validation = (field.validation ?? {}) as {
    min?: number; max?: number; isInteger?: boolean;
  };

  // ── Table ──────────────────────────────────────────────────
  if (fieldIsTable(type)) {
    const cols = field.fields ?? [];
    const rows = (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
    const update = (rIdx: number, key: string, v: unknown) => {
      const next = [...rows];
      next[rIdx] = { ...(next[rIdx] ?? {}), [key]: v };
      onChange(next);
    };
    if (cols.length === 0) {
      return (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-4 text-center text-xs text-slate-500">
          No columns defined yet — open this field's settings and add columns under the “Columns” tab.
        </div>
      );
    }
    const columns = [
      ...cols.map((c) => ({
        title: c.label,
        dataIndex: c.name,
        key: c.name,
        render: (_: unknown, _row: Record<string, unknown>, rIdx: number) =>
          renderCell(
            c,
            rows[rIdx]?.[c.name],
            (v) => update(rIdx, c.name, v),
            disabled,
          ),
      })),
      {
        title: '',
        key: '__actions',
        width: 50,
        render: (_: unknown, _row: Record<string, unknown>, rIdx: number) => (
          <Button
            type="text"
            size="small"
            danger
            disabled={disabled}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => onChange(rows.filter((_, i) => i !== rIdx))}
          />
        ),
      },
    ];
    return (
      <div>
        <AntTable
          size="small"
          bordered
          columns={columns}
          dataSource={rows.map((r, i) => ({ key: i, ...r }))}
          pagination={false}
          locale={{ emptyText: 'No rows yet' }}
        />
        <Button
          type="dashed"
          block
          size="small"
          className="!mt-2"
          icon={<Plus className="h-3.5 w-3.5" />}
          disabled={disabled}
          onClick={() => onChange([...rows, {}])}
        >
          Add row
        </Button>
      </div>
    );
  }

  switch (type) {
    case 'textarea':
      return (
        <TextArea
          id={id}
          rows={3}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoSize={{ minRows: 3, maxRows: 8 }}
        />
      );

    case 'richtext':
      return (
        <TextArea
          id={id}
          rows={6}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Rich text editor — wire ReactQuill if needed'}
          disabled={disabled}
          autoSize={{ minRows: 6, maxRows: 16 }}
        />
      );

    case 'number':
      return (
        <InputNumber
          id={id}
          value={value as number | null | undefined}
          onChange={(v) => onChange(v ?? null)}
          placeholder={placeholder}
          disabled={disabled}
          className="!w-full"
        />
      );

    case 'slider': {
      const sMin = validation.min ?? 0;
      const sMax = validation.max ?? 100;
      const step = validation.isInteger ? 1 : undefined;
      return (
        <div>
          <Slider
            value={typeof value === 'number' ? value : sMin}
            onChange={(v) => onChange(v)}
            disabled={disabled}
            min={sMin}
            max={sMax}
            step={step}
          />
          <div className="flex justify-between text-[10px] text-slate-400 -mt-1 px-0.5">
            <span>{sMin}</span>
            <span>{sMax}</span>
          </div>
        </div>
      );
    }

    case 'range': {
      const v = (value as { start?: number; end?: number }) ?? {};
      const rMin = validation.min ?? 0;
      const rMax = validation.max ?? 100;
      const step = validation.isInteger ? 1 : undefined;
      return (
        <div>
          <Slider
            range
            value={[v.start ?? rMin, v.end ?? rMax]}
            onChange={(arr) => {
              const [start, end] = arr as [number, number];
              onChange({ start, end });
            }}
            disabled={disabled}
            min={rMin}
            max={rMax}
            step={step}
          />
          <div className="flex justify-between text-[10px] text-slate-400 -mt-1 px-0.5">
            <span>{rMin}</span>
            <span>{rMax}</span>
          </div>
        </div>
      );
    }

    case 'password':
      return (
        <Password
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      );

    case 'date':
      return (
        <DatePicker
          id={id}
          value={dateValue(value)}
          onChange={(d) => onChange(d ? d.format('YYYY-MM-DD') : null)}
          placeholder={placeholder ?? 'Select date'}
          disabled={disabled}
          className="!w-full"
        />
      );

    case 'time':
      return (
        <TimePicker
          id={id}
          value={dateValue(value ? `2000-01-01T${value as string}` : null)}
          onChange={(d) => onChange(d ? d.format('HH:mm') : null)}
          placeholder={placeholder ?? 'Select time'}
          disabled={disabled}
          format="HH:mm"
          className="!w-full"
        />
      );

    case 'date_range': {
      const v = (value as { start?: string; end?: string }) ?? {};
      return (
        <DateRangePicker
          value={[dateValue(v.start), dateValue(v.end)]}
          onChange={(range) => {
            if (!range) return onChange({ start: null, end: null });
            const [s, e] = range as [Dayjs | null, Dayjs | null];
            onChange({
              start: s ? s.format('YYYY-MM-DD') : null,
              end:   e ? e.format('YYYY-MM-DD') : null,
            });
          }}
          disabled={disabled}
          className="!w-full"
        />
      );
    }

    case 'time_range': {
      const v = (value as { start?: string; end?: string }) ?? {};
      return (
        <TimeRangePicker
          value={[
            dateValue(v.start ? `2000-01-01T${v.start}` : null),
            dateValue(v.end   ? `2000-01-01T${v.end}`   : null),
          ]}
          onChange={(range) => {
            if (!range) return onChange({ start: null, end: null });
            const [s, e] = range as [Dayjs | null, Dayjs | null];
            onChange({
              start: s ? s.format('HH:mm') : null,
              end:   e ? e.format('HH:mm') : null,
            });
          }}
          disabled={disabled}
          format="HH:mm"
          className="!w-full"
        />
      );
    }

    case 'select':
      return (
        <Select
          id={id}
          value={(value as string | number | undefined) ?? undefined}
          onChange={(v) => onChange(v)}
          placeholder={placeholder ?? 'Select an option'}
          disabled={disabled}
          allowClear
          options={(field.options ?? []).map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          className="!w-full"
        />
      );

    case 'radio':
      return (
        <Radio.Group
          value={value as string | number | undefined}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          options={(field.options ?? []).map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      );

    case 'checkbox':
      return (
        <Checkbox.Group
          value={Array.isArray(value) ? (value as (string | number)[]) : []}
          onChange={(arr) => onChange(arr)}
          disabled={disabled}
          options={(field.options ?? []).map((o) => ({
            value: o.value as string | number,
            label: o.label,
          }))}
        />
      );

    case 'switch':
      return (
        <Switch
          checked={!!value}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      );

    case 'color':
      return (
        <ColorPicker
          value={(value as string) ?? '#6366f1'}
          onChange={(_, css) => onChange(css)}
          disabled={disabled}
          showText
        />
      );

    case 'file':
    case 'image':
      return (
        <Upload
          beforeUpload={() => false} // never upload — just collect file metadata
          maxCount={1}
          disabled={disabled}
          listType={type === 'image' ? 'picture' : 'text'}
          onChange={(info) => {
            const f = info.fileList[0];
            if (!f) return onChange(null);
            onChange({
              name: f.name,
              size: f.size,
              type: f.type,
              uid: f.uid,
            });
          }}
        >
          <Button
            disabled={disabled}
            icon={
              type === 'image'
                ? <ImageIcon className="h-3.5 w-3.5" />
                : <UploadIcon className="h-3.5 w-3.5" />
            }
          >
            {type === 'image' ? 'Choose image' : 'Choose file'}
          </Button>
        </Upload>
      );

    case 'signature':
      return (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 bg-slate-50/40">
          <PenLine className="h-5 w-5 mx-auto mb-1 text-slate-400" />
          Signature pad placeholder — wire ESignatureModal in production.
        </div>
      );

    case 'multi_text': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {arr.map((v, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={v}
                onChange={(e) => {
                  const next = [...arr];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                disabled={disabled}
              />
              <Button
                danger
                type="text"
                disabled={disabled}
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => onChange(arr.filter((_, j) => j !== i))}
              />
            </div>
          ))}
          <Button
            type="dashed"
            block
            size="small"
            disabled={disabled}
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => onChange([...arr, ''])}
          >
            Add value
          </Button>
        </div>
      );
    }

    default:
      return (
        <Input
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
  }
}
