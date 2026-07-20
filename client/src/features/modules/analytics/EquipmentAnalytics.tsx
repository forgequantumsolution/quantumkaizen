/**
 * Equipment analytics panel (spec §6).
 *
 * Read-only projection of the module's own Equipment tickets — every KPI/chart
 * is derived client-side from the passed `tickets`; nothing is fetched or
 * hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a StatTile strip, and a two-column ChartCard grid.
 */
import { useMemo } from 'react';
import {
  Boxes,
  Activity as ActivityIcon,
  Wrench,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import {
  ChartCard,
  StatTile,
  DonutChart,
  BarSplit,
  TrendLineChart,
  AgingBucketChart,
  ComplianceGauge,
  CategoryParetoChart,
  // metrics
  isClosed,
  isOverdue,
  countBy,
  statusSlices,
  openClosedTrend,
  agingByCreation,
  onTimeClosureRate,
  avgOpenAge,
} from '@/components/analytics';
import type { ModuleAnalyticsProps } from './types';
import { useTicketFilters } from './useTicketFilters';

export default function EquipmentAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const underMaintenance = filtered.filter((t) => !!t.isOnHold).length;
    const overdueQual = filtered.filter(isOverdue).length;

    return {
      total: filtered.length,
      inUse: open.length,
      underMaintenance,
      overdueQual,
      avgAge: avgOpenAge(filtered),
      status: statusSlices(filtered),
      classification: countBy(filtered, (t) => t.classification),
      trend: openClosedTrend(filtered),
      openAging: agingByCreation(open),
      pmCompliance: onTimeClosureRate(filtered),
      breakdownByDept: countBy(filtered, (t) => t.department?.name),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Right-aligned Filter popover (shared across all module panels) */}
      {toolbar}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile tone="blue" icon={<Boxes size={16} />} label="Total" value={m.total} hint="Equipment records" onClick={onDrill && (() => onDrill('all'))} />
        <StatTile tone="emerald" icon={<ActivityIcon size={16} />} label="In Use" value={m.inUse} hint="Open / active" onClick={onDrill && (() => onDrill('open'))} />
        <StatTile tone="amber" icon={<Wrench size={16} />} label="Under Maintenance" value={m.underMaintenance} hint="On hold" onClick={onDrill && (() => onDrill('onhold'))} />
        <StatTile tone="red" icon={<AlertTriangle size={16} />} label="Overdue Qualification" value={m.overdueQual} hint="Open & past due" onClick={onDrill && (() => onDrill('overdue'))} />
        <StatTile tone="purple" icon={<Timer size={16} />} label="Avg Age" value={`${m.avgAge}d`} hint="Open records" onClick={onDrill && (() => onDrill('all'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Status Split" subtitle="Equipment by current lifecycle status">
          <DonutChart data={m.status} emptyLabel="No equipment records" />
        </ChartCard>

        <ChartCard title="Qualification / Classification" subtitle="Records grouped by classification">
          <BarSplit data={m.classification} emptyLabel="No classification recorded" />
        </ChartCard>

        <ChartCard title="Activity Trend" subtitle="Equipment records raised vs closed — last 6 months">
          <TrendLineChart
            data={m.trend as unknown as Array<Record<string, string | number>>}
            series={[
              { key: 'created', name: 'Raised' },
              { key: 'completed', name: 'Closed' },
            ]}
            emptyLabel="No activity yet"
          />
        </ChartCard>

        <ChartCard title="PM Compliance" subtitle="On-time maintenance closure vs 90% target">
          <ComplianceGauge
            value={m.pmCompliance}
            target={90}
            label="PM compliance"
            caption="On-time closure"
          />
        </ChartCard>

        <ChartCard title="Open Equipment Aging" subtitle="Open / active equipment records by age since raised">
          <AgingBucketChart data={m.openAging} emptyLabel="No open equipment" />
        </ChartCard>

        <ChartCard title="Breakdown Pareto" subtitle="Breakdowns ranked by department with cumulative %">
          <CategoryParetoChart data={m.breakdownByDept} cumulativeLine emptyLabel="No breakdown data yet" />
        </ChartCard>
      </div>
    </div>
  );
}
