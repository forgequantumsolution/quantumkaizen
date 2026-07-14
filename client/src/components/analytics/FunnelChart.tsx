/**
 * FunnelChart — purpose-built stage funnel with stage-to-stage conversion %
 * (spec §6: Sample Status Funnel, Pending Approvals Funnel, Change Control
 * approval-stage funnel). Pure CSS/flex bars — no chart lib needed, so it reads
 * crisply at any width.
 */
import { EmptyChart, SERIES_COLORS } from './kit';
import type { Slice } from './metrics';

export interface FunnelChartProps {
  /** Ordered stages (first = widest). Value = count reaching that stage. */
  stages: Slice[];
  height?: number;
  emptyLabel?: string;
}

export default function FunnelChart({
  stages,
  height = 240,
  emptyLabel = 'No records in workflow',
}: FunnelChartProps) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  const hasData = stages.some((s) => s.value > 0);
  if (!hasData) return <EmptyChart label={emptyLabel} height={height} />;

  return (
    <div className="flex w-full flex-col gap-2.5">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const prev = i > 0 ? stages[i - 1]!.value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
        return (
          <div key={s.name} className="flex items-center gap-3">
            <div className="w-36 shrink-0 text-right" title={s.name}>
              <div className="truncate text-[11.5px] font-medium text-gray-600">{s.name}</div>
            </div>
            <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-gray-100">
              <div
                className="flex h-full items-center rounded-lg px-2.5 transition-all"
                style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: color }}
              >
                <span className="text-[12px] font-bold text-white tabular-nums">{s.value}</span>
              </div>
            </div>
            <div className="w-11 shrink-0 text-right text-[10px] text-gray-400 tabular-nums">
              {conv !== null ? `${conv}%` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
