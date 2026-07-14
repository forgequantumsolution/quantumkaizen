/**
 * Maintenance analytics panel (spec §6).
 *
 * Read-only projection of the module's own Maintenance tickets — every KPI/chart
 * is derived client-side from the passed `tickets`; nothing is fetched or
 * hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a StatTile strip, and a two-column ChartCard grid.
 */
import { useMemo } from 'react';
import {
  Wrench,
  AlertTriangle,
  ShieldCheck,
  Timer,
  CalendarClock,
} from 'lucide-react';
import {
  ChartCard,
  StatTile,
  ComplianceGauge,
  TrendLineChart,
  DonutChart,
  BarSplit,
  CalendarList,
  // metrics
  isCompleted,
  isOverdue,
  monthlyCount,
  onTimeClosureRate,
  avgCycleDays,
  daysUntil,
  PALETTE,
  type Slice,
} from '@/components/analytics';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';
import { useTicketFilters } from './useTicketFilters';

/** Avg cycle time (days) of completed records, grouped by department. */
function mttrByDepartment(tickets: TicketSummary[]): Slice[] {
  const sums = new Map<string, { total: number; count: number }>();
  for (const t of tickets) {
    if (!isCompleted(t)) continue;
    const dept = t.department?.name;
    if (!dept) continue;
    const days =
      (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 86_400_000;
    const acc = sums.get(dept) ?? { total: 0, count: 0 };
    acc.total += days;
    acc.count += 1;
    sums.set(dept, acc);
  }
  return Array.from(sums.entries())
    .map(([name, { total, count }]) => ({ name, value: Math.round(total / count) }))
    .sort((a, b) => b.value - a.value);
}

export default function MaintenanceAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isCompleted(t));
    const completed = filtered.filter(isCompleted).length;
    const due7 = open.filter((t) => {
      const d = daysUntil(t.dueDate);
      return !isNaN(d) && d >= 0 && d <= 7;
    }).length;

    return {
      openTasks: open.length,
      overdue: filtered.filter(isOverdue).length,
      pmCompliance: onTimeClosureRate(filtered),
      avgCycle: avgCycleDays(filtered),
      due7,
      breakdownTrend: monthlyCount(filtered, () => true, (t) => t.createdAt),
      // PM-to-Breakdown proxy: completed = planned (preventive) work closed;
      // open = unplanned (breakdown) work still in progress.
      pmRatio: [
        { name: 'Planned (PM)', value: completed, color: PALETTE.green },
        { name: 'Unplanned (breakdown)', value: open.length, color: PALETTE.bad },
      ],
      mttrByDept: mttrByDepartment(filtered),
      upcoming: [...open]
        .filter((t) => !!t.dueDate)
        .sort(
          (a, b) =>
            new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime(),
        )
        .map((t) => ({
          id: t.id,
          title: t.title,
          meta: [t.uniqueId, t.department?.name].filter(Boolean).join(' · '),
          date: t.dueDate,
        })),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Right-aligned Filter popover */}
      {toolbar}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile tone="blue" icon={<Wrench size={16} />} label="Open Tasks" value={m.openTasks} hint="In progress" onClick={onDrill && (() => onDrill('open'))} />
        <StatTile tone="red" icon={<AlertTriangle size={16} />} label="Overdue" value={m.overdue} hint="Past due date" onClick={onDrill && (() => onDrill('overdue'))} />
        <StatTile tone="emerald" icon={<ShieldCheck size={16} />} label="PM Compliance" value={`${m.pmCompliance}%`} hint="On-time closure" onClick={onDrill && (() => onDrill('completed'))} />
        <StatTile tone="amber" icon={<Timer size={16} />} label="Avg Cycle" value={`${m.avgCycle}d`} hint="Open → close" onClick={onDrill && (() => onDrill('all'))} />
        <StatTile tone="purple" icon={<CalendarClock size={16} />} label="Due (7d)" value={m.due7} hint="Next 7 days" onClick={onDrill && (() => onDrill('all'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="PM Compliance" subtitle="On-time maintenance closure vs 90% target">
          <ComplianceGauge
            value={m.pmCompliance}
            target={90}
            label="PM compliance"
            caption="On-time closure"
          />
        </ChartCard>

        <ChartCard title="Breakdown Count Trend" subtitle="Maintenance tasks raised — last 6 months">
          <TrendLineChart
            data={m.breakdownTrend}
            series={[{ key: 'value', name: 'Breakdowns' }]}
            emptyLabel="No maintenance activity yet"
          />
        </ChartCard>

        <ChartCard title="PM-to-Breakdown Ratio" subtitle="Planned (PM) vs unplanned (breakdown) — proxy">
          <DonutChart data={m.pmRatio} emptyLabel="No maintenance records" />
        </ChartCard>

        <ChartCard title="MTTR by Department" subtitle="Avg cycle days of completed tasks per department">
          <BarSplit data={m.mttrByDept} valueLabel="Avg days" emptyLabel="No completed tasks yet" />
        </ChartCard>

        <ChartCard title="Upcoming PM Schedule" subtitle="Open maintenance tasks by due date">
          <CalendarList entries={m.upcoming} emptyLabel="Nothing scheduled" />
        </ChartCard>
      </div>
    </div>
  );
}
