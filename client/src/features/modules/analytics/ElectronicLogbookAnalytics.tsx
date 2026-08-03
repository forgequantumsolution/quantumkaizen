/**
 * Electronic Logbook (ELOG) analytics panel.
 *
 * Read-only projection of the module's own logbook entries — every KPI/chart is
 * derived client-side from the passed `tickets`; nothing is fetched or
 * hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * An e-logbook lives or dies on *contemporaneous review*: an entry that sits
 * unreviewed for weeks is a data-integrity finding, not just a late task. So
 * this panel is built around review turnaround (a 7-day SLA rather than the
 * generic 30), where entries are queued, and which areas are keeping up —
 * instead of the fallback dashboard's status/priority/department cuts.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ShieldCheck,
  Hourglass,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import {
  ChartCard,
  ComplianceGauge,
  AgingBucketChart,
  HeatMapMatrix,
  ScorecardTable,
  CalendarList,
  scorePill,
  // metrics
  isClosed,
  isCompletedSuccessfully,
  daysSince,
  agingByCreationFine,
  countBy,
  closureRate,
  avgCycleDays,
  PALETTE,
  type CalendarEntry,
  type Slice,
  type ScorecardColumn,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';

/**
 * Days an entry may wait for QA review before it stops being contemporaneous.
 * Deliberately tighter than the 30-day default used by change-style modules.
 */
const REVIEW_SLA_DAYS = 7;

/** Weekday buckets, Monday-first — weekend gaps are the interesting signal. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const stageOf = (t: TicketSummary) =>
  t.flows[0]?.currentStages[0]?.name ?? 'Unassigned';

interface DeptRow {
  name: string;
  entries: number;
  released: number;
  pending: number;
  reviewRate: number;
  oldestDays: number;
}

export default function ElectronicLogbookAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const navigate = useNavigate();

  // No panel-level Filter: the module header owns the one Filter button and
  // hands this panel an already-scoped list.
  const filtered = tickets;

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const released = filtered.filter(isCompletedSuccessfully);
    // "Late" is measured from entry age against the review SLA, not the due
    // date: most logbook entries carry no due date, so a dueDate-only check
    // would report a clean board while entries quietly age.
    const lateReview = open.filter((t) => daysSince(t.createdAt) > REVIEW_SLA_DAYS);

    // Entries recorded per weekday. Sparse or zero weekend bars are worth
    // seeing on a logbook — they usually mean a shift isn't logging.
    const weekdayCounts = new Array(WEEKDAYS.length).fill(0) as number[];
    for (const t of filtered) {
      const d = new Date(t.createdAt);
      if (isNaN(d.getTime())) continue;
      // JS: 0 = Sunday. Shift so Monday is index 0.
      weekdayCounts[(d.getDay() + 6) % 7]! += 1;
    }
    const byWeekday: Slice[] = WEEKDAYS.map((name, i) => ({
      name,
      value: weekdayCounts[i]!,
      color: i >= 5 ? PALETTE.slate : PALETTE.blue,
    }));

    // Department × stage — which area's entries are queued where.
    const deptNames = countBy(filtered, (t) => t.department?.name).map((s) => s.name);
    const stageNames = countBy(open, stageOf).map((s) => s.name);
    const cell = new Map<string, number>();
    for (const t of open) {
      const d = t.department?.name;
      if (!d) continue;
      const k = `${d}|${stageOf(t)}`;
      cell.set(k, (cell.get(k) ?? 0) + 1);
    }

    // Per-department scorecard — review rate is the column that matters.
    const deptRows: DeptRow[] = deptNames.map((name) => {
      const rows = filtered.filter((t) => t.department?.name === name);
      const rowsOpen = rows.filter((t) => !isClosed(t));
      return {
        name,
        entries: rows.length,
        released: rows.filter(isCompletedSuccessfully).length,
        pending: rowsOpen.length,
        reviewRate: closureRate(rows),
        oldestDays: rowsOpen.reduce((mx, t) => Math.max(mx, daysSince(t.createdAt)), 0),
      };
    });

    // Longest-waiting entries first — the review queue, worst end up top.
    const queue: CalendarEntry[] = [...open]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((t) => ({
        id: t.id,
        title: t.title,
        meta: [t.uniqueId, stageOf(t), t.department?.name].filter(Boolean).join(' · '),
        // Waiting time, not a due date — the chip is the entry's age.
        chip: `${daysSince(t.createdAt)}d unreviewed`,
      }));

    return {
      total: filtered.length,
      released: released.length,
      pending: open.length,
      lateReview: lateReview.length,
      avgReviewDays: avgCycleDays(filtered),
      reviewRate: closureRate(filtered),
      byWeekday,
      deptNames,
      stageNames,
      cellValue: (r: number, c: number) =>
        cell.get(`${deptNames[r]}|${stageNames[c]}`) ?? 0,
      deptRows,
      backlogAge: agingByCreationFine(open, REVIEW_SLA_DAYS),
      queue,
    };
  }, [filtered]);

  const deptColumns: ScorecardColumn<DeptRow>[] = [
    { key: 'name', header: 'Department', render: (r) => <span className="font-medium text-gray-800">{r.name}</span> },
    { key: 'entries', header: 'Entries', align: 'right', render: (r) => r.entries },
    { key: 'released', header: 'Released', align: 'right', render: (r) => r.released },
    { key: 'pending', header: 'Pending', align: 'right', render: (r) => r.pending },
    {
      key: 'oldest',
      header: 'Oldest',
      align: 'right',
      render: (r) => (
        <span className={r.oldestDays > REVIEW_SLA_DAYS ? 'font-semibold text-red-600' : 'text-gray-600'}>
          {r.pending === 0 ? '—' : `${r.oldestDays}d`}
        </span>
      ),
    },
    { key: 'rate', header: 'Reviewed', align: 'right', render: (r) => scorePill(r.reviewRate, 90, 70) },
  ];

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard accent="blue" icon={BookOpen} label="Entries" value={m.total} onClick={onDrill && (() => onDrill('all'))} />
        <KpiCard accent="emerald" icon={ShieldCheck} label="Reviewed" value={m.released} onClick={onDrill && (() => onDrill('completed'))} />
        <KpiCard accent="amber" icon={Hourglass} label="Awaiting review" value={m.pending} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="red" icon={AlertTriangle} label={`Late (>${REVIEW_SLA_DAYS}d)`} value={m.lateReview} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="purple" icon={Timer} label="Avg review" value={`${m.avgReviewDays}d`} onClick={onDrill && (() => onDrill('completed'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Review Compliance" subtitle="Entries reviewed & released vs 95% target">
          <ComplianceGauge
            value={m.reviewRate}
            target={95}
            label="Entries reviewed"
            caption={`${m.released} of ${m.total} released`}
          />
        </ChartCard>

        <ChartCard title="Review Backlog Age" subtitle={`Unreviewed entries by age; past ${REVIEW_SLA_DAYS}d flagged red`}>
          <AgingBucketChart data={m.backlogAge} emptyLabel="Nothing awaiting review" />
        </ChartCard>

        <ChartCard title="Logging Activity by Weekday" subtitle="When entries are recorded — thin bars mean an uncovered shift">
          {/* Column layout so Mon→Sun reads left to right. */}
          <AgingBucketChart
            data={m.byWeekday}
            valueLabel="Entries"
            emptyLabel="No entries recorded yet"
          />
        </ChartCard>

        <ChartCard title="Queue by Department & Stage" subtitle="Open entries — where each area's records are parked" bodyAlign="top">
          <HeatMapMatrix
            rows={m.deptNames}
            cols={m.stageNames}
            value={m.cellValue}
            rowHeader="Department"
            colHeader="Stage"
            emptyLabel="No open entries to map"
            fill
          />
        </ChartCard>

        <ChartCard title="Department Scorecard" subtitle="Review performance per area, busiest first" bodyAlign="top">
          <ScorecardTable
            rows={m.deptRows}
            columns={deptColumns}
            rowKey={(r) => r.name}
            height={300}
            emptyLabel="No department data yet"
          />
        </ChartCard>

        <ChartCard title="Awaiting QA Review" subtitle="Open entries, longest unreviewed first" bodyAlign="top">
          {/* Entry ids are ticket ids, so a row opens its logbook record. */}
          <CalendarList
            entries={m.queue}
            height={300}
            emptyLabel="No entries awaiting review"
            onEntryClick={(e) => navigate(`/tickets/${e.id}`)}
          />
        </ChartCard>
      </div>
    </div>
  );
}
