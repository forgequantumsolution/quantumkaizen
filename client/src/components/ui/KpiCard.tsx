// Canonical KPI / metric tile for the app.
//
// Vertical layout: top accent border, big tabular-nums value, icon chip top-right,
// optional sparkline + trend pill in the footer. Colors come from the project's
// Tailwind tokens (compliant / caution / critical / pharma / surface / ink),
// so theme/appearance changes propagate without touching this file.
import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// All supported accent tokens — the legacy horizontal KpiCard accepted
// slate/indigo/emerald/amber/rose/violet/sky; StatsCard used named colors via a
// hex map. Both vocabularies are aliased here so existing call sites keep
// working through the migration.
export type KpiAccent =
  | 'gold' | 'amber' | 'orange'
  | 'blue' | 'sky'
  | 'purple' | 'violet' | 'indigo'
  | 'cyan'
  | 'red' | 'rose'
  | 'green' | 'emerald'
  | 'neutral' | 'slate'
  | 'navy';

interface AccentClasses {
  /** Top border accent. */
  bar: string;
  /** Icon chip background + text. */
  chip: string;
  /** Sparkline fill (text-* used with fill-current). */
  spark: string;
}

const ACCENT: Record<KpiAccent, AccentClasses> = {
  gold:    { bar: 'border-t-pharma-500',    chip: 'bg-pharma-50 text-pharma-700',         spark: 'text-pharma-500'    },
  amber:   { bar: 'border-t-caution-500',   chip: 'bg-caution-50 text-caution-700',       spark: 'text-caution-500'   },
  orange:  { bar: 'border-t-orange-500',    chip: 'bg-orange-50 text-orange-700',         spark: 'text-orange-500'    },
  blue:    { bar: 'border-t-blue-500',      chip: 'bg-blue-50 text-blue-700',             spark: 'text-blue-500'      },
  sky:     { bar: 'border-t-sky-500',       chip: 'bg-sky-50 text-sky-700',               spark: 'text-sky-500'       },
  purple:  { bar: 'border-t-violet-500',    chip: 'bg-violet-50 text-violet-700',         spark: 'text-violet-500'    },
  violet:  { bar: 'border-t-violet-500',    chip: 'bg-violet-50 text-violet-700',         spark: 'text-violet-500'    },
  indigo:  { bar: 'border-t-indigo-500',    chip: 'bg-indigo-50 text-indigo-700',         spark: 'text-indigo-500'    },
  cyan:    { bar: 'border-t-cyan-500',      chip: 'bg-cyan-50 text-cyan-700',             spark: 'text-cyan-500'      },
  red:     { bar: 'border-t-critical-500',  chip: 'bg-critical-50 text-critical-700',     spark: 'text-critical-500'  },
  rose:    { bar: 'border-t-rose-500',      chip: 'bg-rose-50 text-rose-700',             spark: 'text-rose-500'      },
  green:   { bar: 'border-t-compliant-500', chip: 'bg-compliant-50 text-compliant-700',   spark: 'text-compliant-500' },
  emerald: { bar: 'border-t-emerald-500',   chip: 'bg-emerald-50 text-emerald-700',       spark: 'text-emerald-500'   },
  neutral: { bar: 'border-t-slate-400',     chip: 'bg-slate-100 text-slate-700',          spark: 'text-slate-500'     },
  slate:   { bar: 'border-t-slate-400',     chip: 'bg-slate-100 text-slate-700',          spark: 'text-slate-500'     },
  navy:    { bar: 'border-t-navy-600',      chip: 'bg-navy-50 text-navy-600',             spark: 'text-navy-500'      },
};

export interface KpiTrend {
  value: number;
  label?: string;
  /** When true, +value is bad (overdue, NCs, etc.) — flips pill colors. */
  invert?: boolean;
}

export interface KpiCardProps {
  /** Primary label, rendered uppercase. Prefer `label` for new code. */
  label?: string;
  /** Alias for `label` (StatsCard back-compat). */
  title?: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  accent?: KpiAccent;
  trend?: KpiTrend;
  /** Shown in the footer when no `trend` is supplied. */
  subtitle?: string;
  /** Critical state — forces red accent and value color. */
  alert?: boolean;
  /** Marks this card as the active selection. */
  selected?: boolean;
  /** Mini sparkline (any number of points). */
  sparkline?: number[];
  /** When true, declining sparkline reads as good (e.g. open NCs). */
  sparklineInvert?: boolean;
  onClick?: () => void;
  className?: string;
}

function SparkBars({ data, colorClass }: { data: number[]; colorClass: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const H = 24;
  const W = 48;
  const gap = 1.5;
  const barW = Math.max(2, Math.floor((W - (data.length - 1) * gap) / data.length));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={cn('block shrink-0', colorClass)}>
      {data.map((v, i) => {
        const bh = Math.max(2, Math.round((v / max) * H));
        const x = i * (barW + gap);
        return (
          <rect
            key={i}
            x={x}
            y={H - bh}
            width={barW}
            height={bh}
            rx={1.5}
            fill="currentColor"
            opacity={i === data.length - 1 ? 1 : 0.35 + (i / data.length) * 0.35}
          />
        );
      })}
    </svg>
  );
}

export function KpiCard({
  label,
  title,
  value,
  icon: Icon,
  accent = 'gold',
  trend,
  subtitle,
  alert,
  selected,
  sparkline,
  sparklineInvert,
  onClick,
  className,
}: KpiCardProps) {
  const heading = label ?? title ?? '';
  const effectiveAccent: KpiAccent = alert ? 'red' : accent;
  const a = ACCENT[effectiveAccent];

  // Trend direction → semantic color.
  const trendDirection: 'up' | 'down' | 'flat' =
    !trend || trend.value === 0 ? 'flat' : trend.value > 0 ? 'up' : 'down';
  const isInverted = trend?.invert ?? sparklineInvert ?? false;
  const trendIsGood =
    trendDirection === 'flat'
      ? null
      : isInverted
        ? trendDirection === 'down'
        : trendDirection === 'up';
  const trendToneClass =
    trendIsGood === true  ? 'text-compliant-600' :
    trendIsGood === false ? 'text-critical-600'  :
                            'text-ink-tertiary';
  const TrendIcon =
    trendDirection === 'up'   ? TrendingUp   :
    trendDirection === 'down' ? TrendingDown :
                                Minus;

  // Sparkline color: alert > trend tone > accent default.
  const sparkColorClass = alert
    ? 'text-critical-500'
    : trend
      ? trendIsGood === true
        ? 'text-compliant-500'
        : trendIsGood === false
          ? 'text-critical-500'
          : a.spark
      : a.spark;

  const Wrapper: React.ElementType = onClick ? 'button' : 'div';
  const hasFooter = !!(trend || subtitle || (sparkline && sparkline.length > 0));

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group/kpi relative w-full text-left rounded-2xl bg-surface-card border border-surface-border shadow-card',
        'border-t-[3px]',
        a.bar,
        'p-4 transition-all duration-150',
        onClick &&
          'cursor-pointer hover:shadow-card-hover hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-1',
        selected && 'ring-2 ring-gold ring-offset-1',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-ink-tertiary leading-none mb-2 truncate">
            {heading}
          </p>
          <p
            className={cn(
              'text-3xl font-extrabold leading-none tabular-nums tracking-tight',
              alert ? 'text-critical-600' : 'text-ink',
            )}
          >
            {value}
          </p>
        </div>

        {Icon && (
          <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl shrink-0', a.chip)}>
            <Icon className="h-6 w-6" strokeWidth={2} />
          </span>
        )}
      </div>

      {hasFooter && (
        <div className="mt-3 pt-2.5 border-t border-surface-border flex items-end justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {trend ? (
              <>
                <TrendIcon className={cn('h-3 w-3 shrink-0', trendToneClass)} />
                <span className={cn('text-[11px] font-bold tabular-nums', trendToneClass)}>
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </span>
                {trend.label && (
                  <span className="text-[10px] text-ink-tertiary truncate">{trend.label}</span>
                )}
              </>
            ) : subtitle ? (
              <span className="text-[10px] text-ink-tertiary truncate">{subtitle}</span>
            ) : null}
          </div>
          {sparkline && sparkline.length > 0 && (
            <SparkBars data={sparkline} colorClass={sparkColorClass} />
          )}
        </div>
      )}
    </Wrapper>
  );
}

export default KpiCard;
