/**
 * TrendLineChart (spec §5) — time-series volume/rate trend with an optional
 * benchmark/threshold overlay. Supports one or more series and an area or line
 * render. Consumes any [{ <xKey>, <seriesKey>… }] rows.
 */
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { AXIS_TICK, GRID_STROKE, TT_STYLE, EmptyChart, PALETTE, SERIES_COLORS } from './kit';

export interface TrendSeries {
  key: string;
  name: string;
  color?: string;
  /** Render this series as a filled area (default) or a plain line. */
  area?: boolean;
}

export interface TrendLineChartProps {
  data: Array<Record<string, string | number>>;
  series: TrendSeries[];
  xKey?: string;
  height?: number;
  /** Horizontal benchmark / threshold line (e.g. target TAT, internal rate). */
  benchmarkValue?: number;
  benchmarkLabel?: string;
  unit?: string;
  emptyLabel?: string;
}

export default function TrendLineChart({
  data,
  series,
  xKey = 'month',
  height = 272,
  benchmarkValue,
  benchmarkLabel = 'Target',
  unit,
  emptyLabel = 'No trend data yet',
}: TrendLineChartProps) {
  const hasData =
    data.length > 0 &&
    data.some((row) => series.some((s) => Number(row[s.key]) > 0));
  if (!hasData) return <EmptyChart label={emptyLabel} height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 5 }}>
        <defs>
          {series.map((s, i) => {
            const c = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
            return (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c} stopOpacity={0.45} />
                <stop offset="95%" stopColor={c} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} unit={unit} tickLine={false} axisLine={false} width={30} />
        <Tooltip contentStyle={TT_STYLE} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} />}
        {benchmarkValue !== undefined && (
          <ReferenceLine
            y={benchmarkValue}
            stroke={PALETTE.brand}
            strokeDasharray="5 4"
            label={{ value: benchmarkLabel, position: 'insideTopRight', fill: PALETTE.brand, fontSize: 10 }}
          />
        )}
        {series.map((s, i) => {
          const c = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
          return s.area === false ? (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name}
              stroke={c} strokeWidth={2} dot={{ r: 2.5 }} />
          ) : (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name}
              stroke={c} strokeWidth={2} fill={`url(#grad-${s.key})`} />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
