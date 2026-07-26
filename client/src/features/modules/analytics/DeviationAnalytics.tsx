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
  isClosed, isOverdue, countBy, openClosedTrend,
  onTimeClosureRate, avgCycleDays, avgOpenAge,
  ChartCard,
  TrendLineChart, DonutChart, HBarSplit, ComplianceGauge, CategoryParetoChart,
  type Slice,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';

export default function DeviationAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  // No panel-level Filter: the module header owns the one Filter button and
  // hands this panel an already-scoped list.
  const filtered = tickets;

  const k = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
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
      {/* Top KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Activity} label="Active" value={k.active} accent="blue" onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard icon={AlertTriangle} label="Overdue" value={k.overdue} accent="red" onClick={onDrill && (() => onDrill('overdue'))} />
        <KpiCard icon={Timer} label="Avg age (open)" value={`${k.avgOpen}d`} accent="amber" onClick={onDrill && (() => onDrill('all'))} />
        <KpiCard icon={PauseCircle} label="On hold" value={k.onHold} accent="amber" onClick={onDrill && (() => onDrill('onhold'))} />
        <KpiCard icon={ShieldAlert} label="Critical open" value={k.criticalOpen} accent="red" onClick={onDrill && (() => onDrill('open'))} />
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
