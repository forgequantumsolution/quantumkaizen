/**
 * CAPA Management analytics panel (spec §6.3.1).
 *
 * Read-only projection of the module's own CAPA tickets — every KPI/chart is
 * derived client-side from the passed `tickets`; nothing is fetched or hardcoded
 * and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a KpiCard strip, and a two-column ChartCard grid.
 */
import { useMemo } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Repeat,
} from 'lucide-react';
import {
  ChartCard,
  TrendLineChart,
  AgingBucketChart,
  ComplianceGauge,
  DonutChart,
  HBarSplit,
  CategoryParetoChart,
  // metrics
  isClosed,
  isCompletedSuccessfully,
  isOverdue,
  countBy,
  openClosedTrend,
  dueDatePosture,
  onTimeClosureRate,
  avgCycleDays,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';

/** A CAPA counts as "recurring" when its title flags a repeat/recurring issue. */
const RECURRING_RE = /recurr|repeat/i;
const isRecurring = (t: TicketSummary) => RECURRING_RE.test(t.title);

export default function CapaAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  // No panel-level Filter: the module header owns the one Filter button and
  // hands this panel an already-scoped list.
  const filtered = tickets;

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const completed = filtered.filter(isCompletedSuccessfully);
    const overdue = filtered.filter(isOverdue).length;
    const recurringCount = filtered.filter(isRecurring).length;

    return {
      active: open.length,
      overdue,
      onTimeClosure: onTimeClosureRate(filtered),
      avgCycle: avgCycleDays(filtered),
      recurringRate: filtered.length === 0 ? 0 : Math.round((recurringCount / filtered.length) * 100),
      completedCount: completed.length,
      trend: openClosedTrend(filtered),
      posture: dueDatePosture(filtered),
      source: countBy(filtered, (t) => t.classification),
      rootCause: countBy(filtered, (t) => t.classification || t.severity?.name),
      byPriority: countBy(filtered, (t) => t.priority?.name),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard accent="blue" icon={ActivityIcon} label="Active" value={m.active} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="red" icon={AlertTriangle} label="Overdue" value={m.overdue} onClick={onDrill && (() => onDrill('overdue'))} />
        <KpiCard accent="emerald" icon={CheckCircle2} label="On-Time Closure" value={`${m.onTimeClosure}%`} onClick={onDrill && (() => onDrill('completed'))} />
        <KpiCard accent="amber" icon={Timer} label="Avg Cycle" value={`${m.avgCycle}d`} onClick={onDrill && (() => onDrill('all'))} />
        <KpiCard accent="purple" icon={Repeat} label="Recurring Rate" value={`${m.recurringRate}%`} onClick={onDrill && (() => onDrill('all'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Open vs Closed Trend" subtitle="Created, completed and running open balance — last 6 months">
          <TrendLineChart
            data={m.trend as unknown as Array<Record<string, string | number>>}
            series={[
              { key: 'created', name: 'Created' },
              { key: 'completed', name: 'Completed' },
              { key: 'open', name: 'Open balance', area: false },
            ]}
          />
        </ChartCard>

        <ChartCard title="Aging Buckets" subtitle="Open CAPAs by due-date posture">
          <AgingBucketChart data={m.posture} emptyLabel="No open CAPAs" />
        </ChartCard>

        <ChartCard title="On-Time Closure Rate" subtitle="Completed on or before due date vs 90% target">
          <ComplianceGauge
            value={m.onTimeClosure}
            target={90}
            label="On-time closure"
            caption={`${m.completedCount} closed`}
          />
        </ChartCard>

        <ChartCard title="Source / Classification split" subtitle="Originating source proxied by classification">
          <DonutChart data={m.source} emptyLabel="No classification recorded" />
        </ChartCard>

        <ChartCard title="Root Cause Pareto" subtitle="Ranked cause categories with cumulative %">
          <CategoryParetoChart data={m.rootCause} cumulativeLine emptyLabel="No root-cause data yet" />
        </ChartCard>

        <ChartCard title="CAPAs by Priority" subtitle="Distribution of CAPAs across priority levels">
          <HBarSplit data={m.byPriority} valueLabel="CAPAs" emptyLabel="No priority recorded" />
        </ChartCard>
      </div>
    </div>
  );
}
