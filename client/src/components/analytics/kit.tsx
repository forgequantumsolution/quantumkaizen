/**
 * Shared analytics kit — the brand-consistent primitives every module
 * analytics panel is built from (spec §5 "Shared Component Library").
 *
 * Everything here is recharts-backed and light-theme, matching the existing
 * per-module dashboard (features/modules/ModuleDashboard.tsx) and the executive
 * Dashboard so the visual language stays consistent across all 17 modules.
 *
 * Nothing in this file fetches or mutates data — analytics is strictly a
 * read-only projection of records already loaded by the host page (spec §9
 * data-integrity requirement).
 */
import type { ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';

/** Brand palette — amber/gold accent with consistent semantic colours.
 * Keep green/amber/red meaning stable across every module (spec §8). */
export const PALETTE = {
  // status / generic
  open: '#3B82F6',
  inProgress: '#F59E0B',
  completed: '#22C55E',
  onHold: '#F97316',
  breached: '#EF4444',
  slate: '#64748B',
  // brand + extras
  gold: '#C9A84C',
  brand: '#B97F17',
  blue: '#3B82F6',
  emerald: '#10B981',
  green: '#22C55E',
  pink: '#EC4899',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
  rose: '#F43F5E',
  amber: '#F59E0B',
  indigo: '#6366F1',
  // semantic (on-time / due-soon / overdue) — never let these drift
  good: '#22C55E',
  warn: '#F59E0B',
  bad: '#EF4444',
};

/** Ordered categorical series for charts that need many distinct colours. */
export const SERIES_COLORS = [
  PALETTE.blue, PALETTE.gold, PALETTE.emerald, PALETTE.purple, PALETTE.pink,
  PALETTE.cyan, PALETTE.rose, PALETTE.amber, PALETTE.indigo, PALETTE.slate,
];

/** Consistent recharts tooltip styling — soft, rounded, elevated. */
export const TT_STYLE = {
  borderRadius: '10px',
  border: '1px solid #EEF1F5',
  fontSize: '11px',
  boxShadow: '0 8px 24px -6px rgba(16,24,40,0.18)',
  padding: '8px 12px',
  backgroundColor: '#fff',
};

export const AXIS_TICK = { fontSize: 10.5, fill: '#94A3B8' } as const;
export const GRID_STROKE = '#F1F5F9';

/** A titled chart container. Every analytics widget renders inside one.
 * A thin coloured accent dot ties the card to its metric family. */
export function ChartCard({
  title,
  subtitle,
  action,
  accent,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Optional accent colour for the leading dot (defaults to brand gold). */
  accent?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group flex min-h-[340px] flex-col rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_6px_20px_-8px_rgba(16,24,40,0.15)] ${className ?? ''}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent ?? PALETTE.brand }}
          />
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold leading-tight text-gray-800">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-[11px] leading-snug text-gray-400">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {/* Body fills the card and centres its chart so sparse data still reads as
          an intentional, balanced panel rather than a collapsed one. */}
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

/** Honest empty state — sparse modules show this instead of fake data (spec §11). */
export function EmptyChart({
  label = 'No data yet',
  height = 240,
}: {
  label?: string;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ height }}
    >
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
        <ClipboardList size={18} className="text-gray-400" />
      </div>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

// StatTile lived here. Every KPI/counter tile in the app now renders the one
// shared component — components/ui/KpiCard — so this file no longer defines a
// second card design. Charts and layout helpers below are unaffected.

/**
 * Panel action row (spec §8 export control). The redundant "<Module> Analytics"
 * title/subtitle is intentionally NOT rendered — the module name already appears
 * in the page header above. `title`/`subtitle` stay in the prop type so the 11
 * module panels keep compiling without edits; only `right` (e.g. Export) shows.
 */
export function AnalyticsHeader({
  right,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  if (!right) return null;
  return (
    <div className="flex items-center justify-end gap-2 flex-wrap -mt-1">{right}</div>
  );
}
