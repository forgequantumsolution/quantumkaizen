/**
 * Supplier Quality analytics panel (spec §6.3.9).
 *
 * Read-only projection of the module's own supplier-quality tickets — every
 * KPI/chart is derived client-side from the passed `tickets`; nothing is fetched
 * or hardcoded and sparse data falls back to honest empty states (spec §9/§11).
 *
 * Matches the look & feel of ModuleDashboard: an antd filter bar (options
 * derived from these records), a StatTile strip, and a two-column ChartCard grid.
 *
 * Supplier identity is proxied by `department.name` (the closest structured
 * grouping available on a ticket) so the AVL scorecard / rejection Pareto read
 * per-supplier without inventing data.
 */
import { useMemo } from 'react';
import {
  Building2,
  Activity as ActivityIcon,
  Ban,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import {
  ChartCard,
  StatTile,
  DonutChart,
  ScorecardTable,
  scorePill,
  CategoryParetoChart,
  ComplianceGauge,
  // metrics
  isCompleted,
  isOverdue,
  countBy,
  statusSlices,
  closureRate,
  type ScorecardColumn,
} from '@/components/analytics';
import type { TicketSummary } from '@/lib/api/ticket';
import type { ModuleAnalyticsProps } from './types';
import { useTicketFilters } from './useTicketFilters';

/** A supplier/record counts as disqualified when completed or flagged so. */
const DISQ_RE = /disq/i;
const isDisqualified = (t: TicketSummary) =>
  isCompleted(t) || DISQ_RE.test(t.severity?.name ?? '');

interface SupplierRow {
  name: string;
  records: number;
  onTimePct: number;
  score: number;
}

export default function SupplierQualityAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  const { filtered, toolbar } = useTicketFilters(tickets);

  // ─── Derived metrics ──────────────────────────────────────────────────────
  const m = useMemo(() => {
    const open = filtered.filter((t) => !isCompleted(t));
    const disqualified = filtered.filter(isDisqualified).length;
    const overdue = filtered.filter(isOverdue).length;

    // Supplier scorecard — group by supplier (department proxy).
    const groups = new Map<string, TicketSummary[]>();
    for (const t of filtered) {
      const name = t.department?.name;
      if (!name) continue;
      const list = groups.get(name);
      if (list) list.push(t);
      else groups.set(name, [t]);
    }
    const rows: SupplierRow[] = Array.from(groups.entries())
      .map(([name, list]) => {
        const records = list.length;
        const notOverdue = list.filter((t) => !isOverdue(t)).length;
        const onTimePct = records === 0 ? 0 : Math.round((notOverdue / records) * 100);
        return { name, records, onTimePct, score: onTimePct };
      })
      .sort((a, b) => b.score - a.score);

    const avgScore =
      rows.length === 0
        ? 0
        : Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);

    return {
      total: filtered.length,
      active: open.length,
      disqualified,
      overdue,
      avgScore,
      rows,
      status: statusSlices(filtered),
      rejectionBySupplier: countBy(filtered, (t) => t.department?.name),
      linkedNc: countBy(filtered, (t) => t.classification || t.severity?.name),
      auditCompliance: closureRate(filtered),
    };
  }, [filtered]);

  const scoreColumns: ScorecardColumn<SupplierRow>[] = [
    { key: 'name', header: 'Supplier', align: 'left', render: (r) => r.name },
    { key: 'records', header: 'Records', align: 'right', render: (r) => r.records },
    { key: 'onTime', header: 'On-time %', align: 'right', render: (r) => `${r.onTimePct}%` },
    { key: 'score', header: 'Score', align: 'right', render: (r) => scorePill(r.score) },
  ];

  return (
    <div className="space-y-4">
      {/* Right-aligned Filter popover */}
      {toolbar}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile tone="blue" icon={<Building2 size={16} />} label="Total Records" value={m.total} hint="Supplier-quality records" onClick={onDrill && (() => onDrill('all'))} />
        <StatTile tone="emerald" icon={<ActivityIcon size={16} />} label="Active" value={m.active} hint="Open evaluations" onClick={onDrill && (() => onDrill('open'))} />
        <StatTile tone="red" icon={<Ban size={16} />} label="Disqualified" value={m.disqualified} hint="Completed / flagged disq." onClick={onDrill && (() => onDrill('all'))} />
        <StatTile tone="amber" icon={<AlertTriangle size={16} />} label="Overdue Audits" value={m.overdue} hint="Past due date" onClick={onDrill && (() => onDrill('overdue'))} />
        <StatTile tone="purple" icon={<Gauge size={16} />} label="Avg Score" value={m.avgScore} hint="Mean supplier score" onClick={onDrill && (() => onDrill('all'))} />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="AVL Status Split" subtitle="Active / under evaluation / disqualified (status proxy)">
          <DonutChart data={m.status} emptyLabel="No supplier records" />
        </ChartCard>

        <ChartCard title="Supplier Scorecard" subtitle="Ranked by score — on-time share per supplier">
          <ScorecardTable
            rows={m.rows}
            columns={scoreColumns}
            rowKey={(r) => r.name}
            emptyLabel="No supplier data yet"
          />
        </ChartCard>

        <ChartCard title="Incoming Rejection Rate" subtitle="Rejection / issues by supplier">
          <CategoryParetoChart data={m.rejectionBySupplier} cumulativeLine emptyLabel="No supplier records" />
        </ChartCard>

        <ChartCard title="Audit Schedule Compliance" subtitle="Closed vs 90% target">
          <ComplianceGauge
            value={m.auditCompliance}
            target={90}
            label="Audit schedule compliance"
            caption={`${m.total} records`}
          />
        </ChartCard>

        <ChartCard title="Supplier-Linked NC / Complaint" subtitle="Linked NC/complaint by category">
          <CategoryParetoChart data={m.linkedNc} cumulativeLine emptyLabel="No linked NC/complaint data" />
        </ChartCard>
      </div>
    </div>
  );
}
