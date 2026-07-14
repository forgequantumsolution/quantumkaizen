/**
 * Change Control analytics panel (spec §6.3.2).
 *
 * Read-only projection of the module's own Change Control tickets — every
 * KPI/chart is derived client-side from the passed `tickets`; nothing is fetched
 * or hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches ModuleDashboard: an antd filter bar (options derived from these
 * records), a StatTile strip, and a two-column ChartCard grid.
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
  StatTile,
  TrendLineChart,
  DonutChart,
  BarSplit,
  HBarSplit,
  FunnelChart,
  ComplianceGauge,
  // metrics
  isCompleted,
  isOverdue,
  countBy,
  openClosedTrend,
  stageCounts,
  closureRate,
  avgCycleDays,
  type Slice,
} from '@/components/analytics';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';
import { useTicketFilters } from './useTicketFilters';

/** Cycle time in days for a completed ticket (updatedAt - createdAt). */
const cycleDays = (t: TicketSummary) =>
  (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 86_400_000;

/** Average cycle days grouped by classification, over completed tickets. */
function avgCycleByCategory(tickets: TicketSummary[]): Slice[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const t of tickets) {
    if (!isCompleted(t) || !t.classification) continue;
    const g = groups.get(t.classification) ?? { sum: 0, count: 0 };
    g.sum += cycleDays(t);
    g.count += 1;
    groups.set(t.classification, g);
  }
  return Array.from(groups.entries())
    .map(([name, g]) => ({ name, value: Math.round(g.sum / g.count) }))
    .sort((a, b) => b.value - a.value);
}

export default function ChangeControlAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isCompleted(t));
    const onHold = open.filter((t) => t.isOnHold).length;

    return {
      active: open.length,
      overdue: filtered.filter(isOverdue).length,
      closure: closureRate(filtered),
      onHold,
      avgCycle: avgCycleDays(filtered),
      trend: openClosedTrend(filtered),
      cycleByCategory: avgCycleByCategory(filtered),
      typeSplit: countBy(filtered, (t) => t.priority?.name),
      categorySplit: countBy(filtered, (t) => t.classification),
      approvalStages: stageCounts(open),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Right-aligned Filter popover */}
      {toolbar}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile tone="blue" icon={<ActivityIcon size={16} />} label="Active" value={m.active} hint="Open changes" onClick={onDrill && (() => onDrill('open'))} />
        <StatTile tone="red" icon={<AlertTriangle size={16} />} label="Overdue" value={m.overdue} hint="Past due date" onClick={onDrill && (() => onDrill('overdue'))} />
        <StatTile tone="emerald" icon={<CheckCircle2 size={16} />} label="Closure %" value={`${m.closure}%`} hint="Completed / total" onClick={onDrill && (() => onDrill('completed'))} />
        <StatTile tone="amber" icon={<PauseCircle size={16} />} label="On Hold" value={m.onHold} hint="Open & held" onClick={onDrill && (() => onDrill('onhold'))} />
        <StatTile tone="purple" icon={<Timer size={16} />} label="Avg Cycle" value={`${m.avgCycle}d`} hint="Open → close" onClick={onDrill && (() => onDrill('all'))} />
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

        <ChartCard title="Cycle Time by Category" subtitle="Avg days from open to close, per classification">
          <BarSplit data={m.cycleByCategory} valueLabel="Avg days" emptyLabel="No completed changes yet" />
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
