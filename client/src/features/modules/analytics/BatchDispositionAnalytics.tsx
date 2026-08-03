/**
 * Batch Disposition analytics panel.
 *
 * Read-only projection of the module's own batch records — every KPI/chart is
 * derived client-side from the passed `tickets`; nothing is fetched or
 * hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * The questions this module actually gets asked are not the generic
 * open/closed ones: how many batches are sitting undispositioned (held
 * inventory), how often we release right-first-time, and where in the review
 * chain batches pile up. So the panel leads with Right First Time, a rejection
 * split, waiting-time ageing, and a stage pipeline rather than the fallback
 * dashboard's status/priority/department cuts.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  PackageCheck,
  Hourglass,
  XCircle,
  Timer,
} from 'lucide-react';
import {
  ChartCard,
  ComplianceGauge,
  TrendLineChart,
  DonutChart,
  AgingBucketChart,
  FunnelChart,
  CalendarList,
  // metrics
  isClosed,
  isCompletedSuccessfully,
  isRejected,
  isOnHold,
  daysSince,
  agingByCreationFine,
  monthlyCount,
  countBy,
  avgCycleDays,
  PALETTE,
  type CalendarEntry,
  type Slice,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';
import type { ModuleAnalyticsProps } from './types';

/** Days a batch may sit undispositioned before it counts as ageing (SLA). */
const DISPOSITION_SLA_DAYS = 30;

export default function BatchDispositionAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const navigate = useNavigate();

  // No panel-level Filter: the module header owns the one Filter button and
  // hands this panel an already-scoped list.
  const filtered = tickets;

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const released = filtered.filter(isCompletedSuccessfully);
    const rejected = filtered.filter(isRejected);
    const onHold = open.filter(isOnHold);

    // Right First Time — of the batches that reached a verdict, how many were
    // released rather than rejected. Undispositioned batches are excluded on
    // purpose: they have no verdict yet and would drag the rate down as if
    // they had failed.
    const decided = released.length + rejected.length;
    const rft = decided === 0 ? 0 : Math.round((released.length / decided) * 100);

    // Outcome mix across the whole population, so pending and blocked batches
    // stay visible next to the verdicts rather than being netted out.
    const outcomeMix: Slice[] = [
      { name: 'Released', value: released.length, color: PALETTE.completed },
      { name: 'Rejected', value: rejected.length, color: PALETTE.breached },
      { name: 'On hold', value: onHold.length, color: PALETTE.onHold },
      {
        name: 'In review',
        value: open.length - onHold.length,
        color: PALETTE.inProgress,
      },
    ].filter((s) => s.value > 0);

    // Where open batches are parked. Sorted descending so the widest band is
    // the bottleneck — the stage to staff first.
    const pipeline = countBy(
      open,
      (t) => t.flows[0]?.currentStages[0]?.name ?? 'Unassigned',
    ).sort((a, b) => b.value - a.value);

    // Released vs rejected per month, merged into one row set so both render
    // on a single axis.
    const releasedTrend = monthlyCount(filtered, isCompletedSuccessfully, (t) => t.updatedAt);
    const rejectedTrend = monthlyCount(filtered, isRejected, (t) => t.updatedAt);
    const verdictTrend = releasedTrend.map((r, i) => ({
      month: r.month,
      released: r.value,
      rejected: rejectedTrend[i]?.value ?? 0,
    }));

    // Oldest-waiting batches first — these are the ones holding up shipment.
    const waiting: CalendarEntry[] = [...open]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((t) => ({
        id: t.id,
        title: t.title,
        meta: [t.uniqueId, t.flows[0]?.currentStages[0]?.name, t.department?.name]
          .filter(Boolean)
          .join(' · '),
        // Waiting time, not a due date — the chip is the age in days.
        chip: `${daysSince(t.createdAt)}d waiting`,
      }));

    return {
      total: filtered.length,
      released: released.length,
      rejected: rejected.length,
      pending: open.length,
      onHold: onHold.length,
      avgDays: avgCycleDays(filtered),
      rft,
      decided,
      outcomeMix,
      pipeline,
      verdictTrend,
      ageing: agingByCreationFine(open, DISPOSITION_SLA_DAYS),
      waiting,
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard accent="blue" icon={Boxes} label="Batches" value={m.total} onClick={onDrill && (() => onDrill('all'))} />
        <KpiCard accent="emerald" icon={PackageCheck} label="Released" value={m.released} onClick={onDrill && (() => onDrill('completed'))} />
        <KpiCard accent="amber" icon={Hourglass} label="Pending" value={m.pending} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="red" icon={XCircle} label="Rejected" value={m.rejected} onClick={onDrill && (() => onDrill('all'))} />
        <KpiCard accent="purple" icon={Timer} label="Avg disposition" value={`${m.avgDays}d`} onClick={onDrill && (() => onDrill('completed'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Right First Time" subtitle="Released without rejection vs 95% target">
          <ComplianceGauge
            value={m.rft}
            target={95}
            label="Right first time"
            caption={
              m.decided === 0
                ? 'No batches dispositioned yet'
                : `${m.released} released · ${m.rejected} rejected`
            }
          />
        </ChartCard>

        <ChartCard title="Disposition Pipeline" subtitle="Open batches parked at each review stage — widest is the bottleneck">
          <FunnelChart stages={m.pipeline} emptyLabel="No batches awaiting disposition" />
        </ChartCard>

        <ChartCard title="Released vs Rejected" subtitle="Disposition verdicts — last 6 months">
          <TrendLineChart
            data={m.verdictTrend}
            series={[
              { key: 'released', name: 'Released', color: PALETTE.completed },
              { key: 'rejected', name: 'Rejected', color: PALETTE.breached },
            ]}
            emptyLabel="No disposition verdicts yet"
          />
        </ChartCard>

        <ChartCard title="Waiting Time — pending batches" subtitle={`Days undispositioned; past ${DISPOSITION_SLA_DAYS}d flagged red`}>
          <AgingBucketChart data={m.ageing} emptyLabel="Nothing awaiting disposition" />
        </ChartCard>

        <ChartCard title="Disposition Outcome" subtitle="Verdicts alongside batches still in review or on hold">
          <DonutChart data={m.outcomeMix} centerLabel="batches" emptyLabel="No batch records yet" />
        </ChartCard>

        <ChartCard title="Awaiting Disposition" subtitle="Open batches, longest waiting first" bodyAlign="top">
          {/* Entry ids are ticket ids, so a row opens its batch record. */}
          <CalendarList
            entries={m.waiting}
            height={300}
            emptyLabel="No batches awaiting disposition"
            onEntryClick={(e) => navigate(`/tickets/${e.id}`)}
          />
        </ChartCard>
      </div>
    </div>
  );
}
