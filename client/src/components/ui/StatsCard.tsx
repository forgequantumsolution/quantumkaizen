import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  subtitle?: string;
  className?: string;
  /** Icon background + text color, e.g. "bg-amber-50 text-amber-600" */
  iconColor?: string;
  /** Highlights card as critical-attention item */
  alert?: boolean;
  /** Top accent border color — defaults to gold */
  accent?: string;
}

// KPI accent colors per card type (spec)
export const KPI_ACCENTS = {
  gold:    '#C9A84C',
  blue:    '#3B82F6',
  purple:  '#8B5CF6',
  cyan:    '#06B6D4',
  red:     '#EF4444',
  amber:   '#F59E0B',
  orange:  '#F97316',
  neutral: '#94A3B8',
  green:   '#22C55E',
};

export function StatsCard({
  title, value, icon: Icon, trend, subtitle, className, iconColor, alert, accent,
}: StatsCardProps) {
  const topColor = alert ? KPI_ACCENTS.red : (accent ?? KPI_ACCENTS.gold);

  // Default icon container color based on accent
  const defaultIconStyle: React.CSSProperties = alert
    ? { backgroundColor: '#FEF2F2', color: '#EF4444' }
    : { backgroundColor: 'rgba(201,168,76,0.12)', color: '#A88937' };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        borderTop: `3px solid ${topColor}`,
        boxShadow: '0 2px 8px 0 rgba(0,0,0,0.06)',
      }}
      className={cn('p-5', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Card label — DM Sans 500, 12px, uppercase, spaced */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 truncate leading-none mb-2.5">
            {title}
          </p>
          {/* KPI number — DM Sans 700, 28px */}
          <p
            style={{
              fontSize: '28px',
              fontWeight: 700,
              lineHeight: 1,
              color: alert ? '#EF4444' : '#1A1A2E',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </p>
        </div>

        {/* Icon container */}
        <div
          style={iconColor ? undefined : defaultIconStyle}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
            iconColor,
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
      </div>

      {(trend || subtitle) && (
        <div style={{ borderTop: '1px solid #E8ECF2' }} className="mt-4 pt-3 flex items-center gap-1.5">
          {trend && (
            <>
              {trend.value > 0 ? (
                <TrendingUp className="h-3 w-3 shrink-0" style={{ color: '#EF4444' }} />
              ) : trend.value < 0 ? (
                <TrendingDown className="h-3 w-3 shrink-0" style={{ color: '#22C55E' }} />
              ) : (
                <Minus className="h-3 w-3 shrink-0 text-gray-400" />
              )}
              <span
                className="text-xs font-semibold tabular"
                style={{
                  color: trend.value > 0 ? '#EF4444' : trend.value < 0 ? '#22C55E' : '#94A3B8',
                }}
              >
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </>
          )}
          {subtitle && !trend && (
            <span className="text-xs text-gray-400">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
