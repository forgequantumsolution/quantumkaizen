import dayjs from 'dayjs';
import { COMPLIANCE_OPTIONS } from '@/features/forms/fieldCatalog';
import type { FormFieldDef, FieldOption } from '@/features/forms/types';
import type { ReportField } from './reportTypes';

const EMPTY = '—';

const optionLabel = (options: FieldOption[] | undefined, value: unknown): string => {
  const o = (options ?? []).find((x) => String(x.value) === String(value));
  return o ? String(o.label) : String(value ?? '');
};

const fmtDate = (v: unknown): string => {
  if (!v) return EMPTY;
  const d = dayjs(v as string);
  return d.isValid() ? d.format('DD MMM YYYY') : String(v);
};

// Format a single table cell to a display string (subset of field types).
const cellText = (col: FormFieldDef, v: unknown): string => {
  if (v === null || v === undefined || v === '') return EMPTY;
  switch (col.type) {
    case 'date':
      return fmtDate(v);
    case 'select':
    case 'radio':
      return optionLabel(col.options, v);
    case 'checkbox':
      return v ? '✓' : EMPTY;
    case 'switch':
      return v ? 'Yes' : 'No';
    default:
      return String(v);
  }
};

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Turns a submitted form field + its stored value into a report-ready
 * {label, text, table?}. Plain-data port of the app's <FieldValueText>, so the
 * PDF reads the same as the on-screen read-only submission viewer.
 */
export function formatFieldValue(field: FormFieldDef, value: unknown): ReportField {
  const type = field.type ?? 'text';
  const base = { label: field.label || field.name, type };

  if (type === 'table') {
    const cols = field.fields ?? [];
    const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    if (cols.length === 0 || rows.length === 0) {
      return { ...base, text: 'No rows' };
    }
    return {
      ...base,
      text: '',
      table: {
        columns: cols.map((c) => c.label || c.name),
        rows: rows.map((r) => cols.map((c) => cellText(c, r?.[c.name]))),
      },
    };
  }

  if (isEmpty(value)) return { ...base, text: EMPTY };

  switch (type) {
    case 'password':
      return { ...base, text: '••••••••' };
    case 'range': {
      const v = (value as { start?: number; end?: number }) ?? {};
      return { ...base, text: `${v.start ?? EMPTY} – ${v.end ?? EMPTY}` };
    }
    case 'date':
      return { ...base, text: fmtDate(value) };
    case 'date_range': {
      const v = (value as { start?: string; end?: string }) ?? {};
      return { ...base, text: `${fmtDate(v.start)} – ${fmtDate(v.end)}` };
    }
    case 'time_range': {
      const v = (value as { start?: string; end?: string }) ?? {};
      return { ...base, text: `${v.start ?? EMPTY} – ${v.end ?? EMPTY}` };
    }
    case 'compliance': {
      const o = COMPLIANCE_OPTIONS.find((x) => x.value === value);
      return { ...base, text: o ? o.label : String(value) };
    }
    case 'select':
    case 'radio':
      return { ...base, text: optionLabel(field.options, value) };
    case 'checkbox': {
      const arr = Array.isArray(value) ? value : [value];
      return { ...base, text: arr.map((v) => optionLabel(field.options, v)).join(', ') };
    }
    case 'switch':
      return { ...base, text: value ? 'Yes' : 'No' };
    case 'file':
    case 'image': {
      const f = value as { name?: string } | null;
      return { ...base, text: f?.name || 'No file' };
    }
    case 'signature':
      return { ...base, text: value ? 'Signed' : EMPTY };
    case 'multi_text': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return { ...base, text: arr.join(', ') };
    }
    default:
      return { ...base, text: String(value) };
  }
}
