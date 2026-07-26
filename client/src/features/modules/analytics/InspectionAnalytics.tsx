/**
 * Inspection analytics panel (spec §6).
 *
 * Read-only projection of the module's own Inspection tickets — every KPI/chart
 * is derived client-side from the passed `tickets`; nothing is fetched or
 * hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a KpiCard strip, and a two-column ChartCard grid.
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
  ComplianceGauge,
  TrendLineChart,
  DonutChart,
  AgingBucketChart,
  CategoryParetoChart,
  CalendarList,
  // metrics
  isClosed,
  isCompletedSuccessfully,
  isOverdue,
  countBy,
  openClosedTrend,
  dueDatePosture,
  closureRate,
  PALETTE,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';
import type { ModuleAnalyticsProps } from './types';

export default function InspectionAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  // No panel-level Filter: the module header owns the one Filter button and
  // hands this panel an already-scoped list.
  const filtered = tickets;

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const completed = filtered.filter(isCompletedSuccessfully).length;
    const overdue = filtered.filter(isOverdue);

    return {
      scheduled: filtered.length,
      completed,
      overdue: overdue.length,
      findings: open.length,
      compliance: closureRate(filtered),
      // Scheduled (created) vs Completed over the last 6 months.
      trend: openClosedTrend(filtered),
      // Pass/Fail proxy: completed inspections are treated as "Pass"; open
      // inspections that are past due are treated as "Fail" (unresolved finding).
      passFail: [
        { name: 'Pass', value: completed, color: PALETTE.good },
        { name: 'Fail', value: overdue.length, color: PALETTE.bad },
      ],
      // Age posture of still-open inspections (Overdue / Due soon / On track / No due date).
      openAging: dueDatePosture(open),
      byDepartment: countBy(filtered, (t) => t.department?.name),
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
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard accent="blue" icon={CalendarClock} label="Scheduled" value={m.scheduled} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="emerald" icon={CheckCircle2} label="Completed" value={m.completed} onClick={onDrill && (() => onDrill('completed'))} />
        <KpiCard accent="red" icon={AlertTriangle} label="Overdue" value={m.overdue} onClick={onDrill && (() => onDrill('overdue'))} />
        <KpiCard accent="amber" icon={ClipboardList} label="Findings" value={m.findings} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="purple" icon={ShieldCheck} label="Compliance" value={`${m.compliance}%`} onClick={onDrill && (() => onDrill('completed'))} />
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

        <ChartCard title="Scheduled vs Completed Trend" subtitle="Inspections raised vs closed — last 6 months">
          <TrendLineChart
            data={m.trend as unknown as Array<Record<string, string | number>>}
            series={[
              { key: 'created', name: 'Scheduled' },
              { key: 'completed', name: 'Completed' },
            ]}
            emptyLabel="No inspections yet"
          />
        </ChartCard>

        <ChartCard title="Pass / Fail Rate" subtitle="Completed (pass) vs overdue-open (fail) — proxy">
          {/* Proxy: no explicit pass/fail verdict field exists, so completed
              inspections stand in for "Pass" and overdue-open ones for "Fail". */}
          <DonutChart data={m.passFail} centerLabel="inspections" emptyLabel="No inspection outcomes yet" />
        </ChartCard>

        <ChartCard title="Open Inspection Aging" subtitle="Still-open inspections by due-date posture">
          <AgingBucketChart data={m.openAging} emptyLabel="No open inspections" />
        </ChartCard>

        <ChartCard title="Findings by Department" subtitle="Departments ranked by inspection volume with cumulative %">
          <CategoryParetoChart data={m.byDepartment} cumulativeLine emptyLabel="No department data yet" />
        </ChartCard>

        <ChartCard title="Overdue Inspections" subtitle="Open inspections past their due date, soonest first">
          <CalendarList entries={m.overdueEntries} emptyLabel="No overdue inspections" />
        </ChartCard>
      </div>
    </div>
  );
}
