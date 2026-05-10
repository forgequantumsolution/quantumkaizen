// One field card on the builder canvas. Shows a non-interactive preview of
// how the field will render plus quick actions (move, duplicate, remove)
// and small badges for required / validation / visibility rules.
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, ListChecks, Trash2 } from 'lucide-react';
import { FIELD_CATALOG } from '../fieldCatalog';
import { isRuleConfigured, summariseRule } from '../lib/dependency';
import type { FormFieldDef } from '../types';
import FieldRenderer from '../FieldRenderer';

interface Props {
  field: FormFieldDef;
  selected: boolean;
  hidden?: boolean;          // hidden by a dep rule in the live preview
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export default function FieldCard({
  field, selected, hidden, onSelect, onMoveUp, onMoveDown, onDuplicate, onRemove,
}: Props) {
  const meta = FIELD_CATALOG[field.type ?? ''];
  const Icon = meta?.icon;
  const validationCount = countValidations(field);
  const hasLogic = isRuleConfigured(field.dependency);

  return (
    <div
      onClick={onSelect}
      className={
        'rounded-xl border bg-white p-4 cursor-pointer transition group ' +
        (selected
          ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-sm'
          : 'border-slate-200 hover:border-indigo-200')
      }
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          {Icon && (
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 shrink-0">
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-800 truncate">{field.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{field.type}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {field.required && (
                <span className="text-[10px] font-medium uppercase text-rose-600 bg-rose-50 rounded px-1.5 py-0.5">
                  required
                </span>
              )}
              {validationCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                  <ListChecks className="h-3 w-3" />
                  {validationCount} rule{validationCount === 1 ? '' : 's'}
                </span>
              )}
              {hasLogic && (
                <span className="inline-flex items-center gap-1 text-[10px] text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">
                  {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {summariseRule(field.dependency)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton onClick={onMoveUp}    title="Move up"><ChevronUp className="h-3.5 w-3.5" /></IconButton>
          <IconButton onClick={onMoveDown}  title="Move down"><ChevronDown className="h-3.5 w-3.5" /></IconButton>
          <IconButton onClick={onDuplicate} title="Duplicate"><Copy className="h-3.5 w-3.5" /></IconButton>
          <IconButton onClick={onRemove}    title="Delete" className="hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <div className={hidden ? 'opacity-40' : ''}>
        <FieldRenderer field={field} value={undefined} onChange={() => {}} disabled />
      </div>
    </div>
  );
}

const IconButton = ({
  children, onClick, title, className,
}: {
  children: React.ReactNode; onClick: () => void; title: string; className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={'h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 ' + (className ?? '')}
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
