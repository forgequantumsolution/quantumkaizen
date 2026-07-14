/**
 * CategoryParetoChart (spec §5) — root-cause / category ranking (bars, sorted
 * descending) with an optional cumulative-percent line overlay.
 */
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { AXIS_TICK, GRID_STROKE, TT_STYLE, EmptyChart, PALETTE, SERIES_COLORS } from './kit';
import { pareto, type Slice } from './metrics';

export interface CategoryParetoChartProps {
  /** Raw category slices — sorted & cumulated internally. */
  data: Slice[];
  height?: number;
  cumulativeLine?: boolean;
  limit?: number;
  barColor?: string;
  valueLabel?: string;
  emptyLabel?: string;
}

export default function CategoryParetoChart({
  data,
  height = 272,
  cumulativeLine = true,
  limit = 8,
  barColor,
  valueLabel = 'Count',
  emptyLabel = 'No data yet',
}: CategoryParetoChartProps) {
  const items = pareto(data, limit);
  if (items.length === 0 || items.every((d) => d.value === 0)) {
    return <EmptyChart label={emptyLabel} height={height} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={items} margin={{ top: 8, right: 12, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
        <YAxis yAxisId="left" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
        {cumulativeLine && (
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        )}
        <Tooltip contentStyle={TT_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Bar yAxisId="left" dataKey="value" name={valueLabel} radius={[6, 6, 0, 0]} maxBarSize={44}>
          {items.map((_, i) => (
            <Cell key={i} fill={barColor ?? SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Bar>
        {cumulativeLine && (
          <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %"
            stroke={PALETTE.brand} strokeWidth={2} dot={{ r: 3, fill: PALETTE.brand }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
