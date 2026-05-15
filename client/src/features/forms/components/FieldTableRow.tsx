// One row of the field table. Compact summary by default; the gear toggles
// an expanded settings panel below the row (Options / Validation / Logic).
import { useState } from 'react';
import {
  ChevronDown, ChevronUp, Copy, Eye, ListChecks, Settings, Trash2,
} from 'lucide-react';
import { FIELD_CATALOG, fieldUsesOptions } from '../fieldCatalog';
import { isRuleConfigured, summariseRule } from '../lib/dependency';
import type { FieldType, FormFieldDef } from '../types';
import FieldBlockSettings from './FieldBlockSettings';
import type { ParentField } from './DependencyEditor';

const WIDTH_OPTS = ['25', '33', '50', '66', '75', '100'];

interface Props {
  field: FormFieldDef;
  index: number;
  total: number;
  parents: ParentField[];
  onChange: (patch: Partial<FormFieldDef>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  hidden?: boolean;
  // Render the Type column as an inline dropdown over `fieldTypes`.
  fieldTypes?: FieldType[];
  inlineTypePicker?: boolean;
}

export default function FieldTableRow({
  field, index, total, parents, onChange,
  onMoveUp, onMoveDown, onDuplicate, onRemove, hidden,
  fieldTypes = [], inlineTypePicker = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta = FIELD_CATALOG[field.type ?? ''];
  const Icon = meta?.icon;
  const validationCount = countValidations(field);
  const hasLogic = isRuleConfigured(field.dependency);

  return (
    <>
      <tr
        className={
          'border-b border-slate-100 transition group/row ' +
          (expanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50/70') +
          (hidden ? ' opacity-60' : '')
        }
      >
        {/* # */}
        <td className="px-3 py-2.5 text-[11px] font-mono text-slate-400 w-10">
          {String(index + 1).padStart(2, '0')}
        </td>

        {/* Type */}
        <td className="px-3 py-2.5 w-44">
          {inlineTypePicker ? (
            <div className="inline-flex items-center gap-2 w-full">
              {Icon && (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 shrink-0">
                  <Icon className="h-3 w-3" />
                </span>
              )}
              <select
                value={field.type ?? ''}
                onChange={(e) => {
                  const next = fieldTypes.find((t) => t.name === e.target.value);
                  if (!next) return;
                  const slug = next.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                  const patch: Partial<FormFieldDef> = {
                    type: next.name,
                    type_id: next.id,
                  };
                  // Only re-derive label/name if user hasn't customised them yet.
                  const currentMeta = field.type ? FIELD_CATALOG[field.type] : undefined;
                  if (!field.label || field.label === (currentMeta?.defaultLabel ?? field.type)) {
                    patch.label = next.label;
                  }
                  if (!field.name || field.name.startsWith(field.type ?? '')) {
                    patch.name = `${slug}_${Math.random().toString(36).slice(2, 4)}`;
                  }
                  // Reset options when toggling to/from a type that uses them.
                  if (fieldUsesOptions(next.name) && !field.options) {
                    patch.options = [
                      { label: 'Option 1', value: 'option_1' },
                      { label: 'Option 2', value: 'option_2' },
                    ];
                  } else if (!fieldUsesOptions(next.name) && field.options) {
                    patch.options = undefined;
                  }
                  onChange(patch);
                }}
                className="flex-1 min-w-0 text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {fieldTypes.map((t) => (
                  <option key={t.id} value={t.name}>{t.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2">
              {Icon && (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                  <Icon className="h-3 w-3" />
                </span>
              )}
              <span className="text-xs text-slate-600 truncate">
                {meta?.defaultLabel ?? field.type}
              </span>
            </div>
          )}
        </td>

        {/* Label */}
        <td className="px-3 py-2.5 min-w-0">
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Untitled field"
            className="w-full text-sm font-medium text-slate-800 bg-transparent border-0 outline-none focus:ring-2 focus:ring-indigo-200 rounded px-1 -mx-1"
          />
        </td>

        {/* Field key */}
        <td className="px-3 py-2.5 hidden md:table-cell w-44">
          <input
            value={field.name}
            onChange={(e) => onChange({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
            className="w-full text-[11px] font-mono text-slate-500 bg-transparent border border-transparent hover:border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        </td>

        {/* Required */}
        <td className="px-3 py-2.5 w-16 text-center">
          <button
            type="button"
            onClick={() => onChange({ required: !field.required })}
            className={
              'h-5 w-5 inline-flex items-center justify-center rounded transition text-[11px] font-bold ' +
              (field.required
                ? 'bg-rose-500 text-white'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200')
            }
            title={field.required ? 'Click to make optional' : 'Click to require'}
          >
            *
          </button>
        </td>

        {/* Width */}
        <td className="px-3 py-2.5 hidden lg:table-cell w-28">
          <select
            value={field.width ?? '100'}
            onChange={(e) => onChange({ width: e.target.value })}
            className="text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {WIDTH_OPTS.map((w) => (
              <option key={w} value={w}>{w}%</option>
            ))}
          </select>
        </td>

        {/* Indicators */}
        <td className="px-3 py-2.5 w-32 hidden lg:table-cell">
          <div className="flex items-center gap-1.5 flex-wrap">
            {validationCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5"
                title={`${validationCount} validation rule${validationCount === 1 ? '' : 's'}`}
              >
                <ListChecks className="h-2.5 w-2.5" />{validationCount}
              </span>
            )}
            {hasLogic && (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-violet-700 bg-violet-50 rounded px-1.5 py-0.5 max-w-full truncate"
                title={summariseRule(field.dependency)}
              >
                <Eye className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{summariseRule(field.dependency)}</span>
              </span>
            )}
            {!validationCount && !hasLogic && (
              <span className="text-[10px] text-slate-300">—</span>
            )}
          </div>
        </td>

        {/* Actions */}
        <td className="px-3 py-2.5 w-44 text-right">
          <div className="inline-flex items-center gap-0.5">
            <IconBtn onClick={onMoveUp} disabled={index === 0} title="Move up">
              <ChevronUp className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn onClick={onMoveDown} disabled={index === total - 1} title="Move down">
              <ChevronDown className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn onClick={onDuplicate} title="Duplicate">
              <Copy className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn
              onClick={() => setExpanded((v) => !v)}
              highlight={expanded}
              title={expanded ? 'Close settings' : 'Open settings'}
            >
              <Settings className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn onClick={onRemove} title="Delete" danger>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-indigo-50/30 border-b border-slate-100">
          <td colSpan={8} className="p-0">
            <div className="border-t border-indigo-100 bg-white mx-2 mb-2 rounded-lg overflow-hidden border border-slate-200">
              <FieldBlockSettings field={field} onChange={onChange} parents={parents} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const IconBtn = ({
  children, onClick, title, disabled, danger, highlight,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  highlight?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={
      'h-7 w-7 inline-flex items-center justify-center rounded-md transition ' +
      (disabled
        ? 'text-slate-200 cursor-not-allowed'
        : highlight
        ? 'bg-indigo-100 text-indigo-700'
        : danger
        ? 'text-slate-400 hover:bg-red-50 hover:text-red-500'
        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700')
    }
  >
    {children}
  </button>
);

const countValidations = (f: FormFieldDef): number => {
  const v = (f.validation ?? {}) as Record<string, unknown>;
  return Object.entries(v).filter(([, value]) => {
    if (value === undefined || value === null || value === '') return false;
    if (typeof value === 'boolean') return value;
    return true;
  }).length;
};
