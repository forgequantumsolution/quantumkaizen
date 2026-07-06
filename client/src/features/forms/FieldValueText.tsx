/**
 * Renders a submitted form value as plain, readable text (not an input widget).
 * Used by the read-only submission viewer so filled forms read like a document
 * instead of a page of disabled form controls. Mirrors the value shapes that
 * `FieldRenderer` produces on the way in.
 */
import { FileText } from 'lucide-react';
import dayjs from 'dayjs';
import { COMPLIANCE_OPTIONS } from './fieldCatalog';
import type { FormFieldDef, FieldOption } from './types';

const EMPTY = '—';

function optionLabel(options: FieldOption[] | undefined, value: unknown): string {
  const o = (options ?? []).find((x) => String(x.value) === String(value));
  return o ? String(o.label) : String(value ?? '');
}

function fmtDate(v: unknown): string {
  if (!v) return EMPTY;
  const d = dayjs(v as string);
  return d.isValid() ? d.format('DD MMM YYYY') : String(v);
}

// Format a single table cell (a subset of field types) to a display string.
function cellText(col: FormFieldDef, v: unknown): string {
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
}

const Text = ({ children }: { children: React.ReactNode }) => (
  <span className="text-sm text-gray-800 break-words">{children}</span>
);

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
    {children}
  </span>
);

export default function FieldValueText({
  field,
  value,
}: {
  field: FormFieldDef;
  value: unknown;
}) {
  const type = field.type ?? 'text';

  // ── Table → read-only grid ────────────────────────────────────────────────
  if (type === 'table') {
    const cols = field.fields ?? [];
    const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    if (cols.length === 0 || rows.length === 0) {
      return <span className="text-sm italic text-gray-400">No rows</span>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              {cols.map((c) => (
                <th
                  key={c.name}
                  className="border border-gray-200 px-2 py-1.5 font-medium text-gray-600"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {cols.map((c) => (
                  <td
                    key={c.name}
                    className="border border-gray-200 px-2 py-1.5 align-top text-gray-800"
                  >
                    {cellText(c, r?.[c.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  switch (type) {
    case 'textarea':
    case 'richtext':
      return (
        <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
          {String(value)}
        </p>
      );

    case 'password':
      return <Text>••••••••</Text>;

    case 'number':
    case 'slider':
    case 'time':
      return <Text>{String(value)}</Text>;

    case 'range': {
      const v = (value as { start?: number; end?: number }) ?? {};
      return <Text>{`${v.start ?? EMPTY} – ${v.end ?? EMPTY}`}</Text>;
    }

    case 'date':
      return <Text>{fmtDate(value)}</Text>;

    case 'date_range': {
      const v = (value as { start?: string; end?: string }) ?? {};
      return <Text>{`${fmtDate(v.start)} – ${fmtDate(v.end)}`}</Text>;
    }

    case 'time_range': {
      const v = (value as { start?: string; end?: string }) ?? {};
      return <Text>{`${v.start ?? EMPTY} – ${v.end ?? EMPTY}`}</Text>;
    }

    case 'compliance': {
      const o = COMPLIANCE_OPTIONS.find((x) => x.value === value);
      return o ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-800">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: o.color }}
          />
          {o.label}
        </span>
      ) : (
        <Text>{String(value)}</Text>
      );
    }

    case 'select':
    case 'radio':
      return <Text>{optionLabel(field.options, value)}</Text>;

    case 'checkbox': {
      const arr = Array.isArray(value) ? value : [value];
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map((v, i) => (
            <Chip key={i}>{optionLabel(field.options, v)}</Chip>
          ))}
        </div>
      );
    }

    case 'switch':
      return <Text>{value ? 'Yes' : 'No'}</Text>;

    case 'color':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-800">
          <span
            className="inline-block h-4 w-4 rounded border border-gray-300"
            style={{ backgroundColor: String(value) }}
          />
          {String(value)}
        </span>
      );

    case 'file':
    case 'image': {
      const f = value as { name?: string } | null;
      return f?.name ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-800">
          <FileText size={13} className="shrink-0 text-gray-400" />
          {f.name}
        </span>
      ) : (
        <span className="text-sm italic text-gray-400">No file</span>
      );
    }

    case 'signature':
      return <Text>{value ? 'Signed' : EMPTY}</Text>;

    case 'multi_text': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map((v, i) => (
            <Chip key={i}>{v}</Chip>
          ))}
        </div>
      );
    }

    default:
      return <Text>{String(value)}</Text>;
  }
}
