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
  /** Top accent border color — defaults to amber */
  accent?: string;
  /** When provided, card becomes clickable */
  onClick?: () => void;
  /** Mini sparkline data (7 values) */
  sparkline?: number[];
  /** Whether higher = bad (e.g. overdue items). Flips sparkline color. */
  sparklineInvert?: boolean;
}

// KPI accent colors per card type (spec)
export const KPI_ACCENTS = {
  gold:    '#F59E0B',
  blue:    '#3B82F6',
  purple:  '#8B5CF6',
  cyan:    '#06B6D4',
  red:     '#EF4444',
  amber:   '#F59E0B',
  orange:  '#F97316',
  neutral: '#94A3B8',
  green:   '#22C55E',
};

// Inline mini sparkline bar chart
function SparkBars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const H = 24, W = 48;
  const bars = data.length;
  const barW = Math.floor((W - (bars - 1) * 1.5) / bars);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const bh = Math.max(2, Math.round((v / max) * H));
        const x = i * (barW + 1.5);
        return (
          <rect
            key={i}
            x={x}
            y={H - bh}
            width={barW}
            height={bh}
            rx="1.5"
            fill={color}
            opacity={i === bars - 1 ? 1 : 0.35 + (i / bars) * 0.3}
          />
        );
      })}
    </svg>
  );
}

export function StatsCard({
  title, value, icon: Icon, trend, subtitle, className, iconColor, alert, accent, onClick,
  sparkline, sparklineInvert,
}: StatsCardProps) {
  const topColor = alert ? KPI_ACCENTS.red : (accent ?? KPI_ACCENTS.gold);

  const defaultIconStyle: React.CSSProperties = alert
    ? { backgroundColor: '#FEF2F2', color: '#EF4444' }
    : { backgroundColor: 'rgba(245,158,11,0.10)', color: '#D97706' };

  // Sparkline color: for inverted (higher = bad), green when declining, red when rising
  const sparkColor = alert
    ? '#EF4444'
    : sparklineInvert
      ? (trend && trend.value < 0 ? '#22C55E' : '#EF4444')
      : topColor;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        borderTop: `3px solid ${topColor}`,
        boxShadow: '0 1px 4px 0 rgba(0,0,0,0.07), 0 4px 12px 0 rgba(0,0,0,0.04)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, transform 0.1s ease',
      }}
      className={cn(
        'p-4',
        onClick && 'hover:shadow-md hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#F59E0B]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#9CA3AF',
              lineHeight: 1,
              marginBottom: '8px',
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontSize: '30px',
              fontWeight: 800,
              lineHeight: 1,
              color: alert ? '#EF4444' : '#0D0E17',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {value}
          </p>
        </div>

        {/* Icon */}
        <div
          style={iconColor ? undefined : defaultIconStyle}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
            iconColor,
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </div>
      </div>

      {/* Footer: trend + sparkline */}
      <div className="flex items-end justify-between mt-3 pt-2.5" style={{ borderTop: '1px solid #F3F4F6' }}>
        <div className="flex items-center gap-1.5">
          {trend && (
            <>
              {trend.value > 0 ? (
                <TrendingUp className="h-3 w-3 shrink-0" style={{ color: sparklineInvert ? '#EF4444' : '#22C55E' }} />
              ) : trend.value < 0 ? (
                <TrendingDown className="h-3 w-3 shrink-0" style={{ color: sparklineInvert ? '#22C55E' : '#EF4444' }} />
              ) : (
                <Minus className="h-3 w-3 shrink-0 text-gray-400" />
              )}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: trend.value > 0
                    ? (sparklineInvert ? '#EF4444' : '#22C55E')
                    : trend.value < 0
                      ? (sparklineInvert ? '#22C55E' : '#EF4444')
                      : '#9CA3AF',
                }}
              >
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{trend.label}</span>
            </>
          )}
          {subtitle && !trend && (
            <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{subtitle}</span>
          )}
        </div>

        {sparkline && sparkline.length > 0 && (
          <SparkBars data={sparkline} color={sparkColor} />
        )}
      </div>
    </div>
  );
}
