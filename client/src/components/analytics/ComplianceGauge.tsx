/**
 * ComplianceGauge (spec §5) — single-value % vs. a target threshold, shown as a
 * radial gauge. Colour follows green/amber/red semantics relative to target.
 * Repurposable for any %-compliance KPI (FTR%, PM Compliance%, Closure Rate%,
 * Schedule Compliance%, coverage %, …).
 */
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { PALETTE } from './kit';

export interface ComplianceGaugeProps {
  value: number;            // 0–100
  target?: number;          // threshold; default 90
  label?: string;
  height?: number;
  /** Override the auto (green/amber/red) colour rule. */
  color?: string;
  /** Secondary caption under the value (e.g. "142 / 150 on time"). */
  caption?: string;
}

function autoColor(value: number, target: number): string {
  if (value >= target) return PALETTE.good;
  if (value >= target - 15) return PALETTE.warn;
  return PALETTE.bad;
}

export default function ComplianceGauge({
  value,
  target = 90,
  label,
  height = 200,
  color,
  caption,
}: ComplianceGaugeProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const fill = color ?? autoColor(v, target);
  const data = [{ name: label ?? 'value', value: v, fill }];
  // Semicircle gauge as a pure indicator; the value + label + caption + target
  // all stack BELOW the arc so nothing can overlap the stroke.
  const arcH = Math.round(height * 0.52);

  return (
    <div className="flex flex-col items-center">
      <div className="w-full" style={{ height: arcH }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="74%"
            outerRadius="100%"
            data={data}
            startAngle={180}
            endAngle={0}
            cy="98%"
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: '#EEF1F5' }} dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-col items-center text-center">
        <span className="text-[32px] font-bold leading-none text-gray-900 tabular-nums">{v}%</span>
        {label && <span className="mt-1.5 text-[12px] font-medium text-gray-600">{label}</span>}
        {caption && <span className="mt-0.5 text-[11px] text-gray-400">{caption}</span>}
        <span
          className="mt-1 text-[11px] font-semibold"
          style={{ color: v >= target ? PALETTE.good : PALETTE.bad }}
        >
          Target {target}%
        </span>
      </div>
    </div>
  );
}
