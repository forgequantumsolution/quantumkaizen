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
  ComplianceGauge,
  CategoryParetoChart,
  // metrics
  isCompleted,
  isOverdue,
  countBy,
  statusSlices,
  monthlyCount,
  onTimeClosureRate,
  avgCycleDays,
  avgOpenAge,
} from '@/components/analytics';
import type { ModuleAnalyticsProps } from './types';
import { useTicketFilters } from './useTicketFilters';

export default function EquipmentAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isCompleted(t));
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
      activityTrend: monthlyCount(filtered, () => true, (t) => t.createdAt),
      pmCompliance: onTimeClosureRate(filtered),
      mttr: avgCycleDays(filtered),
      reliability: open.length,
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

        <ChartCard title="Activity Trend" subtitle="Equipment records created — last 6 months">
          <TrendLineChart
            data={m.activityTrend}
            series={[{ key: 'value', name: 'Created' }]}
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

        <ChartCard title="Reliability (MTBF / MTTR proxy)" subtitle="Proxy indicators derived from cycle time and open load">
          {/* Proxy: avg cycle days approximates MTTR (mean time to repair);
              open count approximates reliability load in the absence of
              dedicated failure/uptime telemetry. */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <StatTile tone="amber" icon={<Timer size={16} />} label="MTTR (proxy)" value={`${m.mttr}d`} hint="Avg cycle days" onClick={onDrill && (() => onDrill('all'))} />
            <StatTile tone="blue" icon={<ActivityIcon size={16} />} label="Reliability (proxy)" value={m.reliability} hint="Open load" onClick={onDrill && (() => onDrill('open'))} />
          </div>
        </ChartCard>

        <ChartCard title="Breakdown Pareto" subtitle="Breakdowns ranked by department with cumulative %">
          <CategoryParetoChart data={m.breakdownByDept} cumulativeLine emptyLabel="No breakdown data yet" />
        </ChartCard>
      </div>
    </div>
  );
}
