// One field as a self-contained block. The label, key, required toggle,
// width and help-text are inline; advanced settings (Options, Validation,
// Logic) expand below the field instead of opening a side panel.
import { useState } from 'react';
import {
  ChevronDown, ChevronUp, Copy, GripVertical, Settings, Trash2, Eye, ListChecks,
} from 'lucide-react';
import { FIELD_CATALOG, fieldIsTable } from '../fieldCatalog';
import { isRuleConfigured, summariseRule } from '../lib/dependency';
import type { FormFieldDef } from '../types';
import FieldRenderer from '../FieldRenderer';
import FieldBlockSettings from './FieldBlockSettings';
import type { ParentField } from './DependencyEditor';

const WIDTHS: { v: string; l: string }[] = [
  { v: '25', l: '¼' }, { v: '33', l: '⅓' }, { v: '50', l: '½' },
  { v: '66', l: '⅔' }, { v: '75', l: '¾' }, { v: '100', l: 'Full' },
];

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
  hidden?: boolean; // hidden by a dep rule in the live preview
}

export default function FieldBlock({
  field, index, total, parents, onChange, onMoveUp, onMoveDown, onDuplicate, onRemove, hidden,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isTable = fieldIsTable(field.type);
  // For non-table fields the inline preview is just an ephemeral sandbox. For
  // tables we bind it to `field.value` so rows entered here are saved as the
  // table's default rows (pre-filled when users open the form).
  const [previewValue, setPreviewValue] = useState<unknown>(undefined);
  const meta = FIELD_CATALOG[field.type ?? ''];
  const Icon = meta?.icon;
  const validationCount = countValidations(field);
  const hasLogic = isRuleConfigured(field.dependency);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition group/block">
      {/* Header — always visible */}
      <div className="flex items-start gap-2 p-3 sm:p-4">
        {/* drag handle (visual only) */}
        <span className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab" title="Drag to reorder (coming soon)">
          <GripVertical className="h-4 w-4" />
        </span>

        {/* icon */}
        {Icon && (
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}

        {/* label + key */}
        <div className="flex-1 min-w-0">
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Untitled field"
            className="w-full text-sm font-semibold text-slate-800 bg-transparent border-0 outline-none focus:ring-2 focus:ring-indigo-200 rounded px-1 -mx-1"
          />
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">{field.type}</span>
            <span className="text-slate-300">·</span>
            <input
              value={field.name}
              onChange={(e) => onChange({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
              className="text-[11px] text-slate-500 bg-transparent border-0 outline-none focus:ring-1 focus:ring-indigo-200 rounded px-1 -mx-1 font-mono w-32 truncate"
              title="Field name (used as JSON key)"
            />
            {field.required && (
              <span className="text-[10px] font-medium text-rose-600 bg-rose-50 rounded px-1.5 py-0.5">required</span>
            )}
            {validationCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                <ListChecks className="h-2.5 w-2.5" /> {validationCount}
              </span>
            )}
            {hasLogic && (
              <span className="inline-flex items-center gap-1 text-[10px] text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">
                <Eye className="h-2.5 w-2.5" /> {summariseRule(field.dependency)}
              </span>
            )}
            {hidden && (
              <span className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                hidden by rule
              </span>
            )}
          </div>
        </div>

        {/* quick controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* required toggle */}
          <button
            type="button"
            onClick={() => onChange({ required: !field.required })}
            className={
              'h-7 px-2 rounded-md text-[11px] font-medium transition ' +
              (field.required
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600')
            }
            title="Toggle required"
          >
            *
          </button>
          {/* width selector */}
          <div className="hidden sm:flex items-center bg-slate-50 rounded-md p-0.5">
            {WIDTHS.map((w) => (
              <button
                key={w.v}
                type="button"
                onClick={() => onChange({ width: w.v })}
                className={
                  'h-6 px-1.5 text-[10px] rounded transition ' +
                  ((field.width ?? '100') === w.v
                    ? 'bg-white text-indigo-600 shadow-sm font-medium'
                    : 'text-slate-400 hover:text-slate-600')
                }
                title={`Width: ${w.v}%`}
              >
                {w.l}
              </button>
            ))}
          </div>
          <span className="w-px h-5 bg-slate-200 mx-0.5" />
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
            title={expanded ? 'Collapse settings' : 'Expand settings'}
            highlight={expanded}
          >
            <Settings className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={onRemove} title="Delete" danger>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>

      {/* Live, interactive preview of how the field will render */}
      <div className={'px-4 pb-4 -mt-1 ' + (hidden ? 'opacity-40' : '')}>
        <FieldRenderer
          field={field}
          value={isTable ? field.value : previewValue}
          onChange={isTable ? (v) => onChange({ value: v }) : setPreviewValue}
        />
        {(field as { helpText?: string }).helpText && (
          <p className="mt-1 text-[11px] text-slate-500">
            {(field as { helpText?: string }).helpText}
          </p>
        )}
      </div>

      {expanded && (
        <FieldBlockSettings field={field} onChange={onChange} parents={parents} />
      )}
    </div>
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
        ? 'bg-indigo-50 text-indigo-600'
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
