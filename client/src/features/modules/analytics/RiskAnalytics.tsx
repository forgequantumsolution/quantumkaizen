/**
 * Risk Management analytics panel (spec §6.3.8).
 *
 * Read-only projection of the module's own risk tickets — every KPI/chart is
 * derived client-side from the passed `tickets`; nothing is fetched or hardcoded
 * and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a KpiCard strip, and a two-column ChartCard grid.
 */
import { useMemo } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Timer,
  Flame,
  PauseCircle,
} from 'lucide-react';
import {
  ChartCard,
  HeatMapMatrix,
  CategoryParetoChart,
  TrendLineChart,
  DonutChart,
  AgingBucketChart,
  CalendarList,
  // metrics
  isClosed,
  isOverdue,
  isOnHold,
  daysSince,
  daysUntil,
  countBy,
  openClosedTrend,
  agingByCreation,
  avgOpenAge,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';
import type { CalendarEntry } from '@/components/analytics';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';

/** High-RPN proxy — risks whose severity reads as high/critical. */
const HIGH_RPN_RE = /high|crit/i;

// ─── Risk register heat-map proxy (spec §6.3.8) ─────────────────────────────
// Ticket records carry no explicit Likelihood/Severity (L×S) scores, so this is
// a DOCUMENTED PROXY: likelihood is inferred from priority rank (falling back to
// daysSince(createdAt) % 5), and severity from the severity name. It approximates
// a 5×5 register so the matrix is populated from real records rather than faked.
const LIKELIHOOD_ROWS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
const SEVERITY_COLS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];

const PRIORITY_RANK: Record<string, number> = {
  low: 0,
  minor: 0,
  medium: 2,
  normal: 2,
  high: 3,
  urgent: 4,
  critical: 4,
};

const clamp5 = (n: number) => Math.max(0, Math.min(4, n));

function likelihoodIndex(t: TicketSummary): number {
  const p = t.priority?.name?.toLowerCase();
  if (p && p in PRIORITY_RANK) return PRIORITY_RANK[p]!;
  return clamp5(Math.abs(daysSince(t.createdAt)) % 5);
}

/** Severity name → column index (Minor→1, Major→3, Critical→4, else Moderate=2). */
function severityIndex(name: string | null | undefined): number {
  const n = (name ?? '').toLowerCase();
  if (n.includes('negligible')) return 0;
  if (n.includes('minor')) return 1;
  if (n.includes('major')) return 3;
  if (n.includes('crit') || n.includes('severe')) return 4;
  return 2;
}

export default function RiskAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  // No panel-level Filter: the module header owns the one Filter button and
  // hands this panel an already-scoped list.
  const filtered = tickets;

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const overdue = filtered.filter(isOverdue).length;
    const highRpn = filtered.filter((t) => HIGH_RPN_RE.test(t.severity?.name ?? '')).length;
    const onHold = filtered.filter(isOnHold).length;

    // 5×5 Likelihood × Severity register (documented proxy — see note above).
    const matrix = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
    for (const t of open) {
      const r = clamp5(likelihoodIndex(t));
      const c = clamp5(severityIndex(t.severity?.name));
      matrix[r]![c]!++;
    }

    // Risks due for reassessment — open risks with a due date in the next 60d,
    // soonest first.
    const reassess: CalendarEntry[] = open
      .filter((t) => t.dueDate && !isNaN(daysUntil(t.dueDate)) && daysUntil(t.dueDate) <= 60)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .map((t) => ({
        id: t.id,
        title: t.title,
        meta: `${t.uniqueId}${t.severity?.name ? ` · ${t.severity.name}` : ''}`,
        date: t.dueDate,
      }));

    return {
      active: open.length,
      overdue,
      avgAge: avgOpenAge(filtered),
      highRpn,
      onHold,
      matrix,
      rpn: countBy(filtered, (t) => t.severity?.name ?? t.title),
      trend: openClosedTrend(filtered),
      category: countBy(filtered, (t) => t.classification),
      aging: agingByCreation(open),
      reassess,
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard accent="blue" icon={ActivityIcon} label="Active Risks" value={m.active} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="red" icon={AlertTriangle} label="Overdue Mitigations" value={m.overdue} onClick={onDrill && (() => onDrill('overdue'))} />
        <KpiCard accent="amber" icon={Timer} label="Avg Age" value={`${m.avgAge}d`} onClick={onDrill && (() => onDrill('all'))} />
        <KpiCard accent="purple" icon={Flame} label="High RPN" value={m.highRpn} onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard accent="slate" icon={PauseCircle} label="On Hold" value={m.onHold} onClick={onDrill && (() => onDrill('onhold'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Risk Register Heat Map" subtitle="5×5 Likelihood × Severity — open risks (derived proxy)">
          <HeatMapMatrix
            rows={LIKELIHOOD_ROWS}
            cols={SEVERITY_COLS}
            value={(r, c) => m.matrix[r]?.[c] ?? 0}
            rowHeader="Likelihood"
            colHeader="Severity"
            emptyLabel="No open risks to map"
          />
        </ChartCard>

        <ChartCard title="RPN / severity ranking" subtitle="Ranked severity bands with cumulative %">
          <CategoryParetoChart data={m.rpn} cumulativeLine emptyLabel="No severity data yet" />
        </ChartCard>

        <ChartCard title="New vs Mitigated/Closed" subtitle="Raised vs mitigated and running open balance — last 6 months">
          <TrendLineChart
            data={m.trend as unknown as Array<Record<string, string | number>>}
            series={[
              { key: 'created', name: 'New' },
              { key: 'completed', name: 'Mitigated/Closed' },
              { key: 'open', name: 'Open balance', area: false },
            ]}
          />
        </ChartCard>

        <ChartCard title="Category Split" subtitle="Risks by classification">
          <DonutChart data={m.category} emptyLabel="No classification recorded" />
        </ChartCard>

        <ChartCard title="Open Mitigation Action Aging" subtitle="Open risks by days since raised">
          <AgingBucketChart data={m.aging} emptyLabel="No open risks" />
        </ChartCard>

        <ChartCard title="Risks Due for Reassessment" subtitle="Open risks with a review date in the next 60 days">
          <CalendarList entries={m.reassess} emptyLabel="Nothing due for reassessment" />
        </ChartCard>
      </div>
    </div>
  );
}
