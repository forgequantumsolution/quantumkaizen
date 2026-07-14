/**
 * DonutChart — shared donut/pie for status & category splits (spec §6 uses this
 * across many modules for "Status Split", "Type Split", "Category Split", …).
 * Also exports a simple vertical BarSplit for bar-style distributions.
 */
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { AXIS_TICK, GRID_STROKE, TT_STYLE, EmptyChart, SERIES_COLORS } from './kit';
import type { Slice } from './metrics';

export function DonutChart({
  data,
  height = 272,
  emptyLabel = 'No data yet',
  centerLabel = 'Total',
}: {
  data: Slice[];
  height?: number;
  emptyLabel?: string;
  centerLabel?: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <EmptyChart label={emptyLabel} height={height} />;
  }
  const total = data.reduce((s, d) => s + d.value, 0);
  const colorAt = (e: Slice, i: number) => e.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
  const donut = Math.min(height - 96, 190);

  return (
    <div className="flex flex-col items-center">
      {/* Donut with a centred total */}
      <div className="relative" style={{ width: donut, height: donut }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="64%"
              outerRadius="94%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="#fff"
              strokeWidth={2}
            >
              {data.map((e, i) => (
                <Cell key={e.name} fill={colorAt(e, i)} />
              ))}
            </Pie>
            <Tooltip contentStyle={TT_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[28px] font-bold leading-none text-gray-900 tabular-nums">{total}</span>
          <span className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">{centerLabel}</span>
        </div>
      </div>
      {/* Legend — chips wrap into a tidy grid below the donut */}
      <ul className="mt-4 grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
        {data.map((e, i) => (
          <li key={e.name} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colorAt(e, i) }} />
            <span className="truncate text-gray-600" title={e.name}>{e.name}</span>
            <span className="ml-auto font-semibold text-gray-900 tabular-nums">{e.value}</span>
            <span className="w-8 text-right text-[10px] text-gray-400 tabular-nums">
              {Math.round((e.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarSplit({
  data,
  height = 272,
  color,
  valueLabel = 'Count',
  emptyLabel = 'No data yet',
}: {
  data: Slice[];
  height?: number;
  color?: string;
  valueLabel?: string;
  emptyLabel?: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <EmptyChart label={emptyLabel} height={height} />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
        <Tooltip contentStyle={TT_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Bar dataKey="value" name={valueLabel} radius={[6, 6, 0, 0]} maxBarSize={46}>
          {data.map((e, i) => (
            <Cell key={i} fill={e.color ?? color ?? SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal ranked bar — e.g. approver-wise / workload / by-department. */
export function HBarSplit({
  data,
  height = 272,
  color,
  width = 130,
  valueLabel = 'Count',
  emptyLabel = 'No data yet',
}: {
  data: Slice[];
  height?: number;
  color?: string;
  width?: number;
  valueLabel?: string;
  emptyLabel?: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <EmptyChart label={emptyLabel} height={height} />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 5, bottom: 5 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax']} tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis dataKey="name" type="category" tick={AXIS_TICK} width={width} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={TT_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Bar dataKey="value" name={valueLabel} radius={[0, 6, 6, 0]} maxBarSize={34} label={{ position: 'right', fontSize: 11, fill: '#64748B' }}>
          {data.map((e, i) => (
            <Cell key={i} fill={e.color ?? color ?? SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default DonutChart;
