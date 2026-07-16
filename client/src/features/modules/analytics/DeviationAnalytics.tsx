/**
 * Deviation analytics panel (spec §6.3.4).
 *
 * A read-only projection of the Deviation module's own already-loaded records:
 * every KPI and chart is derived client-side from the passed TicketSummary[].
 * No fetching, no sample data — sparse modules show honest empty states.
 */
import { useMemo } from 'react';
import { Activity, AlertTriangle, Timer, PauseCircle, ShieldAlert } from 'lucide-react';
import type { ModuleAnalyticsProps } from './types';
import type { TicketSummary } from '@/lib/api/ticket';
import {
  isCompleted, isOverdue, countBy, openClosedTrend,
  onTimeClosureRate, avgCycleDays, avgOpenAge,
  ChartCard, StatTile,
  TrendLineChart, DonutChart, HBarSplit, ComplianceGauge, CategoryParetoChart,
  type Slice,
} from '@/components/analytics';
import { useTicketFilters } from './useTicketFilters';

export default function DeviationAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  const k = useMemo(() => {
    const open = filtered.filter((t) => !isCompleted(t));
    const criticalOpen = open.filter((t) => /crit/i.test(t.severity?.name ?? '')).length;
    const capaLinked = filtered.filter((t) => /capa/i.test(t.title)).length;
    const linkageRate = filtered.length ? Math.round((capaLinked / filtered.length) * 100) : 0;

    const trend = openClosedTrend(filtered);
    const classification: Slice[] = countBy(filtered, (t) => t.severity?.name);
    const area: Slice[] = countBy(filtered, (t) => t.department?.name).slice(0, 8);
    const repeat: Slice[] = countBy(filtered, (t) => t.department?.name || t.classification);

    return {
      active: open.length,
      overdue: filtered.filter(isOverdue).length,
      avgOpen: avgOpenAge(filtered),
      onHold: open.filter((t) => t.isOnHold).length,
      criticalOpen,
      onTime: onTimeClosureRate(filtered),
      cycle: avgCycleDays(filtered),
      linkageRate,
      trend,
      classification,
      area,
      repeat,
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Right-aligned Filter popover */}
      {toolbar}

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile icon={<Activity size={16} />} label="Active" value={k.active} tone="blue" onClick={onDrill && (() => onDrill('open'))} />
        <StatTile icon={<AlertTriangle size={16} />} label="Overdue" value={k.overdue} tone="red" onClick={onDrill && (() => onDrill('overdue'))} />
        <StatTile icon={<Timer size={16} />} label="Avg age (open)" value={`${k.avgOpen}d`} tone="amber" onClick={onDrill && (() => onDrill('all'))} />
        <StatTile icon={<PauseCircle size={16} />} label="On hold" value={k.onHold} tone="amber" onClick={onDrill && (() => onDrill('onhold'))} />
        <StatTile icon={<ShieldAlert size={16} />} label="Critical open" value={k.criticalOpen} tone="red" onClick={onDrill && (() => onDrill('open'))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Deviation volume" subtitle="Raised vs closed — last 6 months">
          <TrendLineChart
            data={k.trend as unknown as Array<Record<string, string | number>>}
            series={[
              { key: 'created', name: 'Raised' },
              { key: 'completed', name: 'Closed' },
            ]}
          />
        </ChartCard>

        <ChartCard title="Classification split" subtitle="By severity — Critical / Major / Minor">
          <DonutChart data={k.classification} emptyLabel="No severity data" />
        </ChartCard>

        <ChartCard title="Area / source split" subtitle="By department — Production / QC / Warehouse">
          <HBarSplit data={k.area} width={140} emptyLabel="No department data" />
        </ChartCard>

        <ChartCard title="On-time closure" subtitle="Closed on or before due date">
          <ComplianceGauge value={k.onTime} target={90} label="On-time closure" caption={`Avg cycle ${k.cycle}d`} />
        </ChartCard>

        <ChartCard title="Deviation-to-CAPA linkage" subtitle="Share of deviations with a linked CAPA">
          <ComplianceGauge value={k.linkageRate} target={90} label="CAPA linkage" />
        </ChartCard>

        <ChartCard title="Repeat by area" subtitle="Pareto of recurring deviations by area">
          <CategoryParetoChart data={k.repeat} cumulativeLine emptyLabel="No repeat data" />
        </ChartCard>
      </div>
    </div>
  );
}
