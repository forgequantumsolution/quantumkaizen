// Compact popover used by the inline "+" buttons between fields. Renders
// the panel via a portal so it can never be clipped by an ancestor with
// `overflow-hidden`.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search } from 'lucide-react';
import { FIELD_CATALOG, GROUP_LABELS, type FieldGroup } from '../fieldCatalog';
import type { FieldType } from '../types';

interface Props {
  fieldTypes: FieldType[];
  onPick: (type: FieldType) => void;
  variant?: 'inline' | 'big';
  label?: string;
}

const PANEL_W = 420;
const PANEL_MAX_H = 440;
const GAP = 8;

export default function AddFieldPopover({ fieldTypes, onPick, variant = 'inline', label }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Position the panel under (or above) the trigger.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const compute = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      const triggerCenterX = r.left + r.width / 2;
      let left = triggerCenterX - PANEL_W / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - PANEL_W - 8));
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow >= PANEL_MAX_H + GAP
        ? r.bottom + GAP
        : Math.max(8, r.top - PANEL_MAX_H - GAP);
      setCoords({ left, top });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grouped = useMemo(() => {
    const out: Record<FieldGroup, FieldType[]> = {
      basic: [], choice: [], datetime: [], media: [], advanced: [],
    };
    const q = query.trim().toLowerCase();
    for (const ft of fieldTypes) {
      const meta = FIELD_CATALOG[ft.name];
      if (!meta) continue;
      if (q && !ft.label.toLowerCase().includes(q) && !ft.name.toLowerCase().includes(q)) continue;
      out[meta.group].push(ft);
    }
    return out;
  }, [fieldTypes, query]);

  const total = Object.values(grouped).reduce((n, arr) => n + arr.length, 0);

  const trigger =
    variant === 'inline' ? (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          'group/btn relative w-full h-7 flex items-center justify-center rounded-md text-slate-300 hover:text-indigo-600 transition ' +
          (open ? 'text-indigo-600' : '')
        }
      >
        {/* hairline that extends across the gap */}
        <span
          className={
            'absolute left-0 right-0 h-px transition-colors ' +
            (open ? 'bg-indigo-300' : 'bg-transparent group-hover/btn:bg-indigo-200')
          }
        />
        <span
          className={
            'relative z-10 inline-flex items-center gap-1.5 bg-slate-50 px-2 rounded-full transition ' +
            (open
              ? 'opacity-100 bg-indigo-50'
              : 'opacity-0 group-hover/btn:opacity-100')
          }
        >
          <Plus className="h-3 w-3" />
          <span className="text-[11px] font-medium">{label ?? 'Add field'}</span>
        </span>
      </button>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" /> {label ?? 'Add field'}
      </button>
    );

  return (
    <>
      {trigger}
      {open && coords &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: 'fixed',
              left: coords.left,
              top: coords.top,
              width: PANEL_W,
              maxHeight: PANEL_MAX_H,
              zIndex: 100,
            }}
            className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col"
          >
            <div className="sticky top-0 bg-white p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search field types…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="p-2 flex-1 overflow-auto">
              {total === 0 && (
                <p className="text-sm text-slate-400 py-6 text-center">No matches.</p>
              )}
              {(Object.keys(GROUP_LABELS) as FieldGroup[]).map((g) => {
                const list = grouped[g];
                if (!list.length) return null;
                return (
                  <div key={g} className="mb-2 last:mb-0">
                    <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                      {GROUP_LABELS[g]}
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {list.map((ft) => {
                        const Icon = FIELD_CATALOG[ft.name]?.icon;
                        return (
                          <button
                            key={ft.id}
                            onClick={() => {
                              onPick(ft);
                              setOpen(false);
                              setQuery('');
                            }}
                            className="flex items-center gap-2 px-2 py-2 rounded-md text-left hover:bg-indigo-50 hover:text-indigo-600 transition text-sm"
                          >
                            {Icon && <Icon className="h-4 w-4 text-indigo-500 shrink-0" />}
                            <span className="truncate">{ft.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
