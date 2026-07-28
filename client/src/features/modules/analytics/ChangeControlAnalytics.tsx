/**
 * Change Control analytics panel (spec §6.3.2).
 *
 * Read-only projection of the module's own Change Control tickets — every
 * KPI/chart is derived client-side from the passed `tickets`; nothing is fetched
 * or hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches ModuleDashboard: an antd filter bar (options derived from these
 * records), a KpiCard strip, and a two-column ChartCard grid.
 */
import { useMemo } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  Timer,
} from 'lucide-react';
import {
  ChartCard,
  TrendLineChart,
  DonutChart,
  HBarSplit,
  AgingBucketChart,
  FunnelChart,
  ComplianceGauge,
  // metrics
  isClosed,
  isOverdue,
  countBy,
  openClosedTrend,
  stageCounts,
  closureRate,
  avgCycleDays,
  dueDatePosture,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';
import type { ModuleAnalyticsProps } from './types';

export default function ChangeControlAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  // No panel-level Filter: the module header owns the one Filter button and
  // hands this panel an already-scoped list.
  const filtered = tickets;

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const onHold = open.filter((t) => t.isOnHold).length;

    return {
      active: open.length,
      overdue: filtered.filter(isOverdue).length,
      closure: closureRate(filtered),
      onHold,
      avgCycle: avgCycleDays(filtered),
      trend: openClosedTrend(filtered),
      openAging: dueDatePosture(open),
      typeSplit: countBy(filtered, (t) => t.priority?.name),
      categorySplit: countBy(filtered, (t) => t.classification),
      approvalStages: stageCounts(open),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard accent="blue" icon={ActivityIcon} label="Active" value={m.active} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="red" icon={AlertTriangle} label="Overdue" value={m.overdue} onClick={onDrill && (() => onDrill('overdue'))} />
        <KpiCard accent="emerald" icon={CheckCircle2} label="Closure %" value={`${m.closure}%`} onClick={onDrill && (() => onDrill('completed'))} />
        <KpiCard accent="amber" icon={PauseCircle} label="On Hold" value={m.onHold} onClick={onDrill && (() => onDrill('onhold'))} />
        <KpiCard accent="purple" icon={Timer} label="Avg Cycle" value={`${m.avgCycle}d`} onClick={onDrill && (() => onDrill('all'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Open vs Closed Trend" subtitle="Created vs completed — last 6 months">
          <TrendLineChart
            data={m.trend as unknown as Array<Record<string, string | number>>}
            series={[
              { key: 'created', name: 'Created' },
              { key: 'completed', name: 'Completed' },
            ]}
          />
        </ChartCard>

        <ChartCard title="SLA Posture — Open Changes" subtitle="On-time vs. due-soon vs. overdue against each change's due date">
          <AgingBucketChart data={m.openAging} emptyLabel="No open changes" />
        </ChartCard>

        <ChartCard title="Type Split" subtitle="Change type proxied by priority (Major / Minor / Like-for-like)">
          <DonutChart data={m.typeSplit} emptyLabel="No priority recorded" />
        </ChartCard>

        <ChartCard title="Category Split" subtitle="By classification">
          <HBarSplit data={m.categorySplit} emptyLabel="No classification recorded" />
        </ChartCard>

        <ChartCard title="Pending by Approval Stage" subtitle="Open changes parked at each workflow stage">
          <FunnelChart stages={m.approvalStages} emptyLabel="No changes in workflow" />
        </ChartCard>

        <ChartCard title="Effectiveness Review Completion" subtitle="Share of changes completed vs 90% target">
          <ComplianceGauge value={m.closure} target={90} label="Effectiveness reviews" caption={`${m.active} still open`} />
        </ChartCard>
      </div>
    </div>
  );
}
