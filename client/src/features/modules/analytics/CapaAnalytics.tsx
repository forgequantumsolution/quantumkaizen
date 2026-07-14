/**
 * CAPA Management analytics panel (spec §6.3.1).
 *
 * Read-only projection of the module's own CAPA tickets — every KPI/chart is
 * derived client-side from the passed `tickets`; nothing is fetched or hardcoded
 * and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a StatTile strip, and a two-column ChartCard grid.
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
  StatTile,
  TrendLineChart,
  AgingBucketChart,
  ComplianceGauge,
  DonutChart,
  CategoryParetoChart,
  // metrics
  isCompleted,
  isOverdue,
  countBy,
  openClosedTrend,
  dueDatePosture,
  onTimeClosureRate,
  avgCycleDays,
  monthlyCount,
} from '@/components/analytics';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';
import { useTicketFilters } from './useTicketFilters';

/** A CAPA counts as "recurring" when its title flags a repeat/recurring issue. */
const RECURRING_RE = /recurr|repeat/i;
const isRecurring = (t: TicketSummary) => RECURRING_RE.test(t.title);

export default function CapaAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isCompleted(t));
    const completed = filtered.filter(isCompleted);
    const overdue = filtered.filter(isOverdue).length;
    const recurringCount = filtered.filter(isRecurring).length;

    return {
      active: open.length,
      overdue,
      onTimeClosure: onTimeClosureRate(filtered),
      avgCycle: avgCycleDays(filtered),
      recurringRate: filtered.length === 0 ? 0 : Math.round((recurringCount / filtered.length) * 100),
      recurringCount,
      completedCount: completed.length,
      trend: openClosedTrend(filtered),
      posture: dueDatePosture(filtered),
      source: countBy(filtered, (t) => t.classification),
      rootCause: countBy(filtered, (t) => t.classification || t.severity?.name),
      recurringTrend: monthlyCount(filtered, isRecurring, (t) => t.createdAt),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Right-aligned Filter popover (shared across all module panels) */}
      {toolbar}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile tone="blue" icon={<ActivityIcon size={16} />} label="Active" value={m.active} hint="Open CAPAs" onClick={onDrill && (() => onDrill('open'))} />
        <StatTile tone="red" icon={<AlertTriangle size={16} />} label="Overdue" value={m.overdue} hint="Past due date" onClick={onDrill && (() => onDrill('overdue'))} />
        <StatTile tone="emerald" icon={<CheckCircle2 size={16} />} label="On-Time Closure" value={`${m.onTimeClosure}%`} hint="Closed within SLA" onClick={onDrill && (() => onDrill('completed'))} />
        <StatTile tone="amber" icon={<Timer size={16} />} label="Avg Cycle" value={`${m.avgCycle}d`} hint="Open → close" onClick={onDrill && (() => onDrill('all'))} />
        <StatTile tone="purple" icon={<Repeat size={16} />} label="Recurring Rate" value={`${m.recurringRate}%`} hint={`${m.recurringCount} recurring`} onClick={onDrill && (() => onDrill('all'))} />
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

        <ChartCard title="Recurring Issue Rate" subtitle="CAPAs flagged as recurring / repeat — last 6 months">
          <TrendLineChart
            data={m.recurringTrend}
            series={[{ key: 'value', name: 'Recurring' }]}
            emptyLabel="No recurring issues detected"
          />
        </ChartCard>
      </div>
    </div>
  );
}
