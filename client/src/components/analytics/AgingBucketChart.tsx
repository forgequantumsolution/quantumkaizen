/**
 * AgingBucketChart (spec §5) — backlog-by-age bucketing, e.g. 0-2 / 3-5 / 5+
 * days, or On-time / Due-soon / Overdue. Colour-coded bars with an honest
 * empty state.
 */
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { AXIS_TICK, GRID_STROKE, TT_STYLE, EmptyChart, PALETTE } from './kit';
import type { Slice } from './metrics';

export interface AgingBucketChartProps {
  data: Slice[];
  height?: number;
  /** Vertical (default) or horizontal bars. */
  layout?: 'vertical' | 'horizontal';
  emptyLabel?: string;
  valueLabel?: string;
  onBarClick?: (bucket: Slice) => void;
}

export default function AgingBucketChart({
  data,
  height = 272,
  layout = 'horizontal',
  emptyLabel = 'No open records',
  valueLabel = 'Records',
  onBarClick,
}: AgingBucketChartProps) {
  const hasData = data.some((d) => d.value > 0);
  if (!hasData) return <EmptyChart label={emptyLabel} height={height} />;

  if (layout === 'vertical') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 5, bottom: 5 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax']} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" tick={AXIS_TICK} width={110} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TT_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Bar dataKey="value" name={valueLabel} radius={[0, 6, 6, 0]} maxBarSize={34}
            label={{ position: 'right', fontSize: 11, fill: '#64748B' }}
            onClick={(d: any) => onBarClick?.(d.payload)}
            cursor={onBarClick ? 'pointer' : undefined}>
            {data.map((e, i) => <Cell key={i} fill={e.color ?? PALETTE.blue} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="26%">
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
        <Tooltip contentStyle={TT_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Bar dataKey="value" name={valueLabel} radius={[6, 6, 0, 0]} maxBarSize={52}
          onClick={(d: any) => onBarClick?.(d.payload)}
          cursor={onBarClick ? 'pointer' : undefined}>
          {data.map((e, i) => <Cell key={i} fill={e.color ?? PALETTE.blue} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
