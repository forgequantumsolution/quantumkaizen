/**
 * CalendarList — purpose-built due/upcoming list (spec §6: Stability Pull-Point
 * Calendar, Upcoming PM Schedule, Calibration Due Calendar, Recent
 * Configuration Changes activity list, Risks Due for Reassessment).
 *
 * Each entry carries a title, an optional meta line, and a due/at date rendered
 * as a colour-coded days-away chip.
 */
import { EmptyChart, PALETTE } from './kit';
import { daysUntil } from './metrics';

export interface CalendarEntry {
  id: string;
  title: string;
  meta?: string;
  /** ISO date used for the days-away chip. Omit for plain activity entries. */
  date?: string | null;
  /** Overrides the auto days-away chip (e.g. "by John · 2d ago"). */
  chip?: string;
}

export interface CalendarListProps {
  entries: CalendarEntry[];
  height?: number;
  emptyLabel?: string;
  /** When true, past dates render red (overdue); default true. */
  flagOverdue?: boolean;
  /**
   * Makes each row activatable — typically to open the underlying record.
   * Opt-in: callers whose entry ids don't map to a navigable route (e.g. the
   * audit dashboard's register ids) simply omit it and rows stay static.
   */
  onEntryClick?: (entry: CalendarEntry) => void;
}

function chipFor(date: string): { label: string; color: string } {
  const d = daysUntil(date);
  if (isNaN(d)) return { label: '—', color: PALETTE.slate };
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, color: PALETTE.bad };
  if (d === 0) return { label: 'Today', color: PALETTE.warn };
  if (d <= 7) return { label: `${d}d`, color: PALETTE.warn };
  return { label: `${d}d`, color: PALETTE.good };
}

export default function CalendarList({
  entries,
  height = 260,
  emptyLabel = 'Nothing scheduled',
  onEntryClick,
}: CalendarListProps) {
  if (entries.length === 0) return <EmptyChart label={emptyLabel} height={height} />;
  return (
    <div className="overflow-auto divide-y divide-gray-100" style={{ maxHeight: height }}>
      {entries.map((e) => {
        const chip = e.chip
          ? { label: e.chip, color: PALETTE.slate }
          : e.date
            ? chipFor(e.date)
            : null;

        const body = (
          <>
            <div className="min-w-0 flex-1">
              <div
                className={
                  onEntryClick
                    ? 'text-[13px] font-medium text-gray-800 truncate group-hover:text-blue-600'
                    : 'text-[13px] font-medium text-gray-800 truncate'
                }
              >
                {e.title}
              </div>
              {e.meta && <div className="text-[11px] text-gray-400 truncate">{e.meta}</div>}
            </div>
            {chip && (
              <span
                className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: chip.color }}
              >
                {chip.label}
              </span>
            )}
          </>
        );

        if (!onEntryClick) {
          return (
            <div key={e.id} className="flex items-center gap-3 py-2">
              {body}
            </div>
          );
        }

        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onEntryClick(e)}
            title={`Open ${e.title}`}
            className="group flex w-full items-center gap-3 py-2 px-1 -mx-1 rounded text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-colors"
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
