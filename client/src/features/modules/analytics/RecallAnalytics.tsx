/**
 * Recall Management analytics panel.
 *
 * Read-only projection of the module's own recall records — every KPI/chart is
 * derived client-side from the passed `tickets`; nothing is fetched or
 * hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * A recall is a regulatory clock, not a backlog item: notification and closure
 * windows are measured in days, and a high-hazard recall stuck mid-process is a
 * different problem from ten low-hazard ones. So this panel leads with hazard
 * classification, deadline posture, and where the serious recalls are parked —
 * rather than the fallback dashboard's status/priority/department cuts.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Siren,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import {
  ChartCard,
  ComplianceGauge,
  TrendLineChart,
  DonutChart,
  AgingBucketChart,
  CategoryParetoChart,
  HeatMapMatrix,
  CalendarList,
  // metrics
  isClosed,
  isOverdue,
  daysUntil,
  countBy,
  openClosedTrend,
  onTimeClosureRate,
  avgCycleDays,
  PALETTE,
  type CalendarEntry,
  type Slice,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';

const stageOf = (t: TicketSummary) =>
  t.flows[0]?.currentStages[0]?.name ?? 'Unassigned';

/** Health-hazard class comes from the record's severity; unset is its own bucket. */
const hazardOf = (t: TicketSummary) => t.severity?.name ?? 'Unclassified';

/** Human labels for the ticket classification enum used as the recall trigger. */
const TRIGGER_LABELS: Record<string, string> = {
  PRODUCT: 'Product',
  PROCESS: 'Process',
  SYSTEM: 'System',
  EQUIPMENT: 'Equipment',
  DOCUMENTATION: 'Documentation',
  TRAINING: 'Training',
  OTHER: 'Other',
};

export default function RecallAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const navigate = useNavigate();

  // No panel-level Filter: the module header owns the one Filter button and
  // hands this panel an already-scoped list.
  const filtered = tickets;

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const closed = filtered.filter(isClosed);
    const overdue = open.filter(isOverdue);

    // Hazard mix, coloured from each severity's own configured colour so the
    // chart matches the badges used everywhere else in the app.
    const hazardColor = new Map<string, string>();
    for (const t of filtered) {
      const name = hazardOf(t);
      if (t.severity?.color && !hazardColor.has(name)) hazardColor.set(name, t.severity.color);
    }
    const hazardMix: Slice[] = countBy(filtered, hazardOf).map((s) => ({
      ...s,
      color: hazardColor.get(s.name) ?? PALETTE.slate,
    }));

    // Deadline posture. Built here rather than via `dueWindows` because that
    // helper drops overdue and undated records — on a recall those are the two
    // buckets you most need to see.
    const posture: Slice[] = [
      { name: 'Overdue', value: 0, color: PALETTE.breached },
      { name: 'Due ≤ 3d', value: 0, color: '#F97316' },
      { name: 'Due 4–7d', value: 0, color: PALETTE.inProgress },
      { name: 'Due 8–30d', value: 0, color: PALETTE.blue },
      { name: 'No due date', value: 0, color: PALETTE.slate },
    ];
    for (const t of open) {
      if (!t.dueDate) { posture[4]!.value++; continue; }
      const d = daysUntil(t.dueDate);
      if (isNaN(d)) { posture[4]!.value++; continue; }
      if (d < 0) posture[0]!.value++;
      else if (d <= 3) posture[1]!.value++;
      else if (d <= 7) posture[2]!.value++;
      else if (d <= 30) posture[3]!.value++;
    }

    // Stage × hazard — is a high-hazard recall stuck mid-process?
    const stageNames = countBy(open, stageOf).map((s) => s.name);
    const hazardNames = countBy(open, hazardOf).map((s) => s.name);
    const cell = new Map<string, number>();
    for (const t of open) {
      const k = `${stageOf(t)}|${hazardOf(t)}`;
      cell.set(k, (cell.get(k) ?? 0) + 1);
    }

    // Active recalls, most urgent first: overdue at the top, then soonest due,
    // then anything undated.
    const queue: CalendarEntry[] = [...open]
      .sort((a, b) => {
        const av = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bv = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return av - bv;
      })
      .map((t) => ({
        id: t.id,
        title: t.title,
        meta: [t.uniqueId, stageOf(t), t.severity?.name].filter(Boolean).join(' · '),
        date: t.dueDate,
      }));

    return {
      total: filtered.length,
      open: open.length,
      closed: closed.length,
      overdue: overdue.length,
      avgDays: avgCycleDays(filtered),
      onTime: onTimeClosureRate(filtered),
      hazardMix,
      posture,
      stageNames,
      hazardNames,
      cellValue: (r: number, c: number) =>
        cell.get(`${stageNames[r]}|${hazardNames[c]}`) ?? 0,
      triggers: countBy(filtered, (t) =>
        t.classification ? TRIGGER_LABELS[t.classification] ?? t.classification : null,
      ),
      backlog: openClosedTrend(filtered),
      queue,
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard accent="blue" icon={Siren} label="Recalls" value={m.total} onClick={onDrill && (() => onDrill('all'))} />
        <KpiCard accent="amber" icon={Activity} label="Active" value={m.open} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="emerald" icon={CheckCircle2} label="Closed" value={m.closed} onClick={onDrill && (() => onDrill('completed'))} />
        <KpiCard accent="red" icon={AlertTriangle} label="Past deadline" value={m.overdue} onClick={onDrill && (() => onDrill('overdue'))} />
        <KpiCard accent="purple" icon={Timer} label="Avg closure" value={`${m.avgDays}d`} onClick={onDrill && (() => onDrill('completed'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Health Hazard Classification" subtitle="Recalls by assessed hazard class">
          <DonutChart data={m.hazardMix} centerLabel="recalls" emptyLabel="No recalls classified yet" />
        </ChartCard>

        <ChartCard title="Regulatory Deadline Posture" subtitle="Active recalls by time to their reporting deadline">
          <AgingBucketChart data={m.posture} valueLabel="Recalls" emptyLabel="No active recalls" />
        </ChartCard>

        <ChartCard title="On-Time Closure" subtitle="Recalls closed within deadline vs 100% target">
          <ComplianceGauge
            value={m.onTime}
            target={100}
            label="Closed on time"
            caption={m.closed === 0 ? 'No recalls closed yet' : `${m.closed} closed`}
          />
        </ChartCard>

        <ChartCard title="Recall Triggers" subtitle="What drove the recall, ranked with cumulative share">
          <CategoryParetoChart
            data={m.triggers}
            cumulativeLine
            valueLabel="Recalls"
            emptyLabel="No trigger classification recorded"
          />
        </ChartCard>

        <ChartCard title="Where Recalls Are Stuck" subtitle="Active recalls by stage and hazard class" bodyAlign="top">
          <HeatMapMatrix
            rows={m.stageNames}
            cols={m.hazardNames}
            value={m.cellValue}
            rowHeader="Stage"
            colHeader="Hazard"
            emptyLabel="No active recalls to map"
            fill
          />
        </ChartCard>

        <ChartCard title="Active Recall Backlog" subtitle="Opened vs closed, with the running open balance">
          <TrendLineChart
            data={m.backlog as unknown as Array<Record<string, string | number>>}
            series={[
              { key: 'open', name: 'Still open', color: PALETTE.breached },
              { key: 'created', name: 'Opened', color: PALETTE.blue, area: false },
              { key: 'completed', name: 'Closed', color: PALETTE.completed, area: false },
            ]}
            emptyLabel="No recall history yet"
          />
        </ChartCard>

        <ChartCard title="Active Recalls" subtitle="Most urgent first — past deadline at the top" bodyAlign="top" className="lg:col-span-2">
          {/* Entry ids are ticket ids, so a row opens its recall record. */}
          <CalendarList
            entries={m.queue}
            height={300}
            emptyLabel="No active recalls"
            onEntryClick={(e) => navigate(`/tickets/${e.id}`)}
          />
        </ChartCard>
      </div>
    </div>
  );
}
