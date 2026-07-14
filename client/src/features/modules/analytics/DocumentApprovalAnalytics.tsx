/**
 * Document Approval analytics panel (spec §6.2.2).
 *
 * Read-only projection of the module's own document-approval tickets — every
 * KPI/chart is derived client-side from the passed `tickets`; nothing is fetched
 * or hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a StatTile strip, and a two-column ChartCard grid.
 */
import { useMemo } from 'react';
import {
  ClipboardList,
  AlertTriangle,
  Timer,
  CheckCircle2,
  CalendarClock,
} from 'lucide-react';
import {
  ChartCard,
  StatTile,
  FunnelChart,
  BarSplit,
  AgingBucketChart,
  HBarSplit,
  ComplianceGauge,
  // metrics
  isCompleted,
  isOverdue,
  countBy,
  stageCounts,
  dueDatePosture,
  onTimeClosureRate,
  avgCycleDays,
  type Slice,
} from '@/components/analytics';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';
import { useTicketFilters } from './useTicketFilters';

export default function DocumentApprovalAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isCompleted(t));
    const completed = filtered.filter(isCompleted);
    const overdue = filtered.filter(isOverdue).length;

    const posture = dueDatePosture(open);
    const dueSoon = posture.find((s) => s.name === 'Due-soon')?.value ?? 0;

    // Approval cycle time by document type (classification proxy): avg days
    // open → effective for each completed document type.
    const byType = new Map<string, TicketSummary[]>();
    for (const t of completed) {
      const k = t.classification ?? 'Unclassified';
      const arr = byType.get(k) ?? [];
      arr.push(t);
      byType.set(k, arr);
    }
    const cycleByType: Slice[] = Array.from(byType.entries())
      .map(([name, ts]) => ({ name, value: avgCycleDays(ts) }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      pending: open.length,
      overdue,
      avgCycle: avgCycleDays(filtered),
      onTime: onTimeClosureRate(filtered),
      dueSoon,
      completedCount: completed.length,
      funnel: stageCounts(filtered),
      cycleByType,
      posture,
      pendingByStage: countBy(open, (t) => t.flows[0]?.currentStages[0]?.name),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Right-aligned Filter popover (shared across all module panels) */}
      {toolbar}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile tone="blue" icon={<ClipboardList size={16} />} label="Pending Approvals" value={m.pending} hint="Open documents" onClick={onDrill && (() => onDrill('open'))} />
        <StatTile tone="red" icon={<AlertTriangle size={16} />} label="Overdue" value={m.overdue} hint="Past due date" onClick={onDrill && (() => onDrill('overdue'))} />
        <StatTile tone="amber" icon={<Timer size={16} />} label="Avg Cycle" value={`${m.avgCycle}d`} hint="Draft → effective" onClick={onDrill && (() => onDrill('all'))} />
        <StatTile tone="emerald" icon={<CheckCircle2 size={16} />} label="On-Time %" value={`${m.onTime}%`} hint="Approved within SLA" onClick={onDrill && (() => onDrill('completed'))} />
        <StatTile tone="purple" icon={<CalendarClock size={16} />} label="Due Soon" value={m.dueSoon} hint="Approaching due date" onClick={onDrill && (() => onDrill('all'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Pending Approvals Funnel" subtitle="Documents by current workflow stage (Draft → Review → Approval → Effective)">
          <FunnelChart stages={m.funnel} emptyLabel="No documents in workflow" />
        </ChartCard>

        <ChartCard title="Approval Cycle Time" subtitle="Avg days to effective by document type">
          <BarSplit data={m.cycleByType} valueLabel="Avg days" emptyLabel="No completed approvals yet" />
        </ChartCard>

        <ChartCard title="Aging Buckets" subtitle="Open documents by due-date posture">
          <AgingBucketChart data={m.posture} layout="horizontal" emptyLabel="No pending documents" />
        </ChartCard>

        <ChartCard title="Pending by current stage" subtitle="Approver / stage workload for open documents">
          <HBarSplit data={m.pendingByStage} valueLabel="Pending" emptyLabel="Nothing pending" />
        </ChartCard>

        <ChartCard title="On-time approval" subtitle="Approved on or before due date vs 90% target">
          <ComplianceGauge
            value={m.onTime}
            target={90}
            label="On-time approval"
            caption={`${m.completedCount} approved`}
          />
        </ChartCard>
      </div>
    </div>
  );
}
