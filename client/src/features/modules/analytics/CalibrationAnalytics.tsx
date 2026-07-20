/**
 * Calibration analytics panel (spec §6.4.3).
 *
 * Read-only projection of the module's own calibration tickets — every KPI/chart
 * is derived client-side from the passed `tickets`; nothing is fetched or
 * hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a StatTile strip, and a two-column ChartCard grid.
 */
import { useMemo } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Ruler,
} from 'lucide-react';
import {
  ChartCard,
  StatTile,
  ComplianceGauge,
  AgingBucketChart,
  TrendLineChart,
  CalendarList,
  DonutChart,
  HBarSplit,
  // metrics
  isClosed,
  isOverdue,
  daysUntil,
  statusSlices,
  dueWindows,
  countBy,
  onTimeClosureRate,
  monthlyCount,
  type CalendarEntry,
} from '@/components/analytics';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';
import { useTicketFilters } from './useTicketFilters';

/** Out-of-tolerance signal: title or severity flags OOT / tolerance. */
const OOT_RE = /oot|toleran/i;
const isOOT = (t: TicketSummary) =>
  OOT_RE.test(t.title) || OOT_RE.test(t.severity?.name ?? '');

/** OOT-linked deviations: title flags OOT or deviation. */
const OOT_DEV_RE = /oot|deviation/i;
const CRIT_RE = /crit|high/i;

export default function CalibrationAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const overdueOpen = open.filter(isOverdue);
    const due30 = open.filter((t) => {
      const d = daysUntil(t.dueDate);
      return !isNaN(d) && d >= 0 && d <= 30;
    }).length;
    const ootCount = filtered.filter(isOOT).length;
    const overdueCritical = overdueOpen.filter((t) => CRIT_RE.test(t.priority?.name ?? '')).length;

    const overdueEntries: CalendarEntry[] = overdueOpen
      .filter((t) => t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .map((t) => ({
        id: t.id,
        title: t.title,
        meta: [t.uniqueId, t.department?.name].filter(Boolean).join(' · '),
        date: t.dueDate,
      }));

    return {
      total: filtered.length,
      compliance: onTimeClosureRate(filtered),
      overdue: overdueOpen.length,
      overdueCritical,
      due30,
      ootCount,
      dueWindows: dueWindows(open, (t) => t.dueDate, [7, 30, 60]),
      ootTrend: monthlyCount(filtered, isOOT, (t) => t.createdAt),
      ootDevStatus: statusSlices(filtered.filter((t) => OOT_DEV_RE.test(t.title))),
      byDept: countBy(filtered, (t) => t.department?.name),
      overdueEntries,
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Right-aligned Filter popover */}
      {toolbar}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile tone="blue" icon={<ClipboardList size={16} />} label="Total" value={m.total} hint="Calibration records" onClick={onDrill && (() => onDrill('all'))} />
        <StatTile tone="emerald" icon={<CheckCircle2 size={16} />} label="Compliant" value={`${m.compliance}%`} hint="On-time calibration" onClick={onDrill && (() => onDrill('completed'))} />
        <StatTile tone="red" icon={<AlertTriangle size={16} />} label="Overdue" value={m.overdue} hint="Open & past due" onClick={onDrill && (() => onDrill('overdue'))} />
        <StatTile tone="amber" icon={<CalendarClock size={16} />} label="Due (30d)" value={m.due30} hint="Open due within 30d" onClick={onDrill && (() => onDrill('all'))} />
        <StatTile tone="purple" icon={<Ruler size={16} />} label="OOT" value={m.ootCount} hint="Out-of-tolerance" onClick={onDrill && (() => onDrill('open'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Compliance Rate" subtitle="On-time calibration vs 95% target">
          <ComplianceGauge
            value={m.compliance}
            target={95}
            label="Calibration compliance"
            caption={`${m.total} records`}
          />
        </ChartCard>

        <ChartCard title="Due Calendar" subtitle="Open calibrations by due window">
          <AgingBucketChart
            data={m.dueWindows}
            layout="vertical"
            valueLabel="Due"
            emptyLabel="Nothing due"
          />
        </ChartCard>

        <ChartCard title="Out-of-Tolerance Rate" subtitle="OOT records raised — last 6 months">
          <TrendLineChart
            data={m.ootTrend}
            series={[{ key: 'value', name: 'OOT' }]}
            emptyLabel="No out-of-tolerance events"
          />
        </ChartCard>

        <ChartCard title="Overdue Calibrations" subtitle="Open calibrations past due date, soonest first">
          <CalendarList entries={m.overdueEntries} emptyLabel="No overdue calibrations" />
        </ChartCard>

        <ChartCard title="OOT-Linked Deviation Status" subtitle="Status of OOT / deviation records">
          <DonutChart data={m.ootDevStatus} emptyLabel="No OOT-linked deviations" />
        </ChartCard>

        <ChartCard title="Records by Department" subtitle="Calibration records grouped by department">
          <HBarSplit data={m.byDept} valueLabel="Records" emptyLabel="No department data" />
        </ChartCard>
      </div>
    </div>
  );
}
