// Compact horizontal KPI tile.
// Layout: left column with small uppercase label and a large accent-colored
// value; right side a round tinted icon. A coloured left strip ties the tile
// to its accent. Pass `selected` to render the active state (dark border).
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiAccent =
  | 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky';

export interface KpiTrend {
  value: number;
  direction?: 'up' | 'down' | 'flat';
  period?: string;
  invert?: boolean;
}

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  accent?: KpiAccent;
  trend?: KpiTrend;
  selected?: boolean;       // active card — adds dark navy frame
  onClick?: () => void;
  className?: string;
}

// Static maps so Tailwind JIT picks them up.
const STRIP: Record<KpiAccent, string> = {
  slate:   'before:bg-slate-700',
  indigo:  'before:bg-indigo-500',
  emerald: 'before:bg-emerald-500',
  amber:   'before:bg-amber-500',
  rose:    'before:bg-rose-500',
  violet:  'before:bg-violet-500',
  sky:     'before:bg-sky-500',
};

const VALUE_TEXT: Record<KpiAccent, string> = {
  slate:   'text-slate-900',
  indigo:  'text-indigo-700',
  emerald: 'text-emerald-700',
  amber:   'text-amber-700',
  rose:    'text-rose-700',
  violet:  'text-violet-700',
  sky:     'text-sky-700',
};

const ICON_TINT: Record<KpiAccent, string> = {
  slate:   'bg-slate-100 text-slate-600',
  indigo:  'bg-indigo-100 text-indigo-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  amber:   'bg-amber-100 text-amber-600',
  rose:    'bg-rose-100 text-rose-600',
  violet:  'bg-violet-100 text-violet-600',
  sky:     'bg-sky-100 text-sky-600',
};

const SOFT_BORDER: Record<KpiAccent, string> = {
  slate:   'border-slate-200',
  indigo:  'border-indigo-200/70',
  emerald: 'border-emerald-200/70',
  amber:   'border-amber-200/70',
  rose:    'border-rose-200/70',
  violet:  'border-violet-200/70',
  sky:     'border-sky-200/70',
};

export function KpiCard({
  label, value, icon: Icon, accent = 'slate', trend, selected, onClick, className,
}: KpiCardProps) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        // Base
        'group/kpi relative w-full text-left rounded-xl bg-white shadow-sm',
        'transition-all duration-200',
        // Border colour depends on selection
        selected
          ? 'border-[2px] border-slate-900'
          : cn('border', SOFT_BORDER[accent]),
        // Coloured left strip drawn with `before:`
        'pl-1 before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-r-full',
        STRIP[accent],
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn('text-2xl font-bold tabular-nums leading-none', VALUE_TEXT[accent])}>
              {value}
            </span>
            {trend && <TrendPill trend={trend} />}
          </div>
        </div>

        {Icon && (
          <span
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full shrink-0',
              ICON_TINT[accent],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
    </Wrapper>
  );
}

const TrendPill = ({ trend }: { trend: KpiTrend }) => {
  const direction =
    trend.direction ??
    (trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'flat');
  const isGood =
    direction === 'flat'
      ? null
      : trend.invert
        ? direction === 'down'
        : direction === 'up';
  const Icon =
    direction === 'up'   ? ArrowUpRight   :
    direction === 'down' ? ArrowDownRight : Minus;
  const tone =
    isGood === true  ? 'text-emerald-600' :
    isGood === false ? 'text-rose-600' :
                       'text-slate-500';

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-medium', tone)}>
      <Icon className="h-3 w-3" />
      <span className="tabular-nums">
        {trend.value > 0 ? '+' : ''}{trend.value}%
      </span>
    </span>
  );
};

export default KpiCard;
