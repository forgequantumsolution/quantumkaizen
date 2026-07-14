/**
 * Inspection analytics panel (spec §6).
 *
 * Read-only projection of the module's own Inspection tickets — every KPI/chart
 * is derived client-side from the passed `tickets`; nothing is fetched or
 * hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a StatTile strip, and a two-column ChartCard grid.
 */
import { useMemo } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react';
import {
  ChartCard,
  StatTile,
  ComplianceGauge,
  TrendLineChart,
  BarSplit,
  CategoryParetoChart,
  CalendarList,
  // metrics
  isCompleted,
  isOverdue,
  countBy,
  monthlyCount,
  closureRate,
  PALETTE,
} from '@/components/analytics';
import type { ModuleAnalyticsProps } from './types';
import { useTicketFilters } from './useTicketFilters';

export default function InspectionAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const completed = filtered.filter(isCompleted).length;
    const overdue = filtered.filter(isOverdue);
    const findings = filtered.filter((t) => !isCompleted(t)).length;

    return {
      scheduled: filtered.length,
      completed,
      overdue: overdue.length,
      findings,
      compliance: closureRate(filtered),
      findingsTrend: monthlyCount(filtered, () => true, (t) => t.createdAt),
      // Pass/Fail proxy: completed inspections are treated as "Pass"; open
      // inspections that are past due are treated as "Fail" (unresolved finding).
      passFail: [
        { name: 'Pass', value: completed, color: PALETTE.good },
        { name: 'Fail', value: overdue.length, color: PALETTE.bad },
      ],
      repeatFindings: countBy(filtered, (t) => t.department?.name),
      overdueEntries: [...overdue]
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
        <StatTile tone="blue" icon={<CalendarClock size={16} />} label="Scheduled" value={m.scheduled} hint="Total inspections" onClick={onDrill && (() => onDrill('open'))} />
        <StatTile tone="emerald" icon={<CheckCircle2 size={16} />} label="Completed" value={m.completed} hint="Closed" onClick={onDrill && (() => onDrill('completed'))} />
        <StatTile tone="red" icon={<AlertTriangle size={16} />} label="Overdue" value={m.overdue} hint="Open & past due" onClick={onDrill && (() => onDrill('overdue'))} />
        <StatTile tone="amber" icon={<ClipboardList size={16} />} label="Findings" value={m.findings} hint="Open items" onClick={onDrill && (() => onDrill('open'))} />
        <StatTile tone="purple" icon={<ShieldCheck size={16} />} label="Compliance" value={`${m.compliance}%`} hint="Completed / total" onClick={onDrill && (() => onDrill('completed'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Scheduled vs Completed Compliance" subtitle="Completion rate vs 90% target">
          <ComplianceGauge
            value={m.compliance}
            target={90}
            label="Schedule compliance"
            caption={`${m.completed} of ${m.scheduled} completed`}
          />
        </ChartCard>

        <ChartCard title="Findings / NC Trend" subtitle="Inspection records raised — last 6 months">
          <TrendLineChart
            data={m.findingsTrend}
            series={[{ key: 'value', name: 'Findings' }]}
            emptyLabel="No findings yet"
          />
        </ChartCard>

        <ChartCard title="Overdue Inspections" subtitle="Open inspections past their due date">
          <div className="mb-3">
            <StatTile tone="red" icon={<AlertTriangle size={16} />} label="Overdue" value={m.overdue} hint="Open & past due" onClick={onDrill && (() => onDrill('overdue'))} />
          </div>
          <CalendarList entries={m.overdueEntries} emptyLabel="No overdue inspections" />
        </ChartCard>

        <ChartCard title="Pass / Fail Rate" subtitle="Completed (pass) vs overdue-open (fail) — proxy">
          {/* Proxy: no explicit pass/fail verdict field exists, so completed
              inspections stand in for "Pass" and overdue-open ones for "Fail". */}
          <BarSplit data={m.passFail} emptyLabel="No inspection outcomes yet" />
        </ChartCard>

        <ChartCard title="Repeat Finding Pareto" subtitle="Findings ranked by department with cumulative %">
          <CategoryParetoChart data={m.repeatFindings} cumulativeLine emptyLabel="No repeat-finding data yet" />
        </ChartCard>
      </div>
    </div>
  );
}
