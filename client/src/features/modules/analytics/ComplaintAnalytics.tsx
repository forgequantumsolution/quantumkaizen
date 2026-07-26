/**
 * Product Complaint analytics panel (spec §6.3.3).
 *
 * A read-only projection of the Complaint module's own already-loaded records:
 * every KPI and chart is derived client-side from the passed TicketSummary[].
 * No fetching, no sample data — sparse modules show honest empty states.
 */
import { useMemo } from 'react';
import { Activity, AlertTriangle, Timer, CheckCircle2, Megaphone } from 'lucide-react';
import type { ModuleAnalyticsProps } from './types';
import type { TicketSummary } from '@/lib/api/ticket';
import {
  isClosed, isOverdue, countBy, monthlyCount, openClosedTrend,
  onTimeClosureRate, closureRate, avgCycleDays,
  ChartCard,
  TrendLineChart, DonutChart, ComplianceGauge, CategoryParetoChart, CalendarList,
  type Slice, type CalendarEntry,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';

const REPORTABLE = /report|regulator/i;

export default function ComplaintAnalytics({ tickets, onDrill }: ModuleAnalyticsProps) {
  // No panel-level Filter: the module header owns the one Filter button and
  // hands this panel an already-scoped list.
  const filtered = tickets;

  const k = useMemo(() => {
    const open = filtered.filter((t) => !isClosed(t));
    const reportable = filtered.filter((t) => REPORTABLE.test(t.title));
    const capaConverted = filtered.filter((t) => /capa/i.test(t.title)).length;
    const conversionRate = filtered.length ? Math.round((capaConverted / filtered.length) * 100) : 0;

    const monthly = monthlyCount(filtered, () => true, (t) => t.createdAt);
    const trend = monthly.map((p) => ({ month: p.month, count: p.value }));
    const flow = openClosedTrend(filtered);
    const avgMonthly = monthly.length
      ? Math.round(monthly.reduce((s, p) => s + p.value, 0) / monthly.length)
      : 0;

    const category: Slice[] = countBy(filtered, (t) => t.classification);
    const productSite: Slice[] = countBy(filtered, (t) => t.site?.name || t.department?.name);

    const reportableEntries: CalendarEntry[] = reportable
      .filter((t) => !isClosed(t))
      .map((t) => ({
        id: t.id,
        title: t.title,
        meta: `${t.uniqueId}${t.department?.name ? ` · ${t.department.name}` : ''}`,
        date: t.dueDate,
      }));

    return {
      active: open.length,
      overdue: filtered.filter(isOverdue).length,
      cycle: avgCycleDays(filtered),
      closure: closureRate(filtered),
      reportable: reportable.length,
      onTime: onTimeClosureRate(filtered),
      conversionRate,
      trend,
      flow,
      avgMonthly,
      category,
      productSite,
      reportableEntries,
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Top KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Activity} label="Active" value={k.active} accent="blue" onClick={onDrill && (() => onDrill('open'))} />
        <KpiCard icon={AlertTriangle} label="Overdue" value={k.overdue} accent="red" onClick={onDrill && (() => onDrill('overdue'))} />
        <KpiCard icon={Timer} label="Avg cycle" value={`${k.cycle}d`} accent="amber" onClick={onDrill && (() => onDrill('all'))} />
        <KpiCard icon={CheckCircle2} label="Closure" value={`${k.closure}%`} accent="emerald" onClick={onDrill && (() => onDrill('completed'))} />
        <KpiCard icon={Megaphone} label="Reportable" value={k.reportable} accent="purple" onClick={onDrill && (() => onDrill('all'))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Complaint volume" subtitle="Received vs closed — last 6 months">
          <TrendLineChart
            data={k.flow as unknown as Array<Record<string, string | number>>}
            series={[
              { key: 'created', name: 'Received' },
              { key: 'completed', name: 'Closed' },
            ]}
          />
        </ChartCard>

        <ChartCard title="Complaint rate" subtitle="Monthly volume vs. average benchmark">
          <TrendLineChart
            data={k.trend}
            series={[{ key: 'count', name: 'Complaints', area: false }]}
            benchmarkValue={k.avgMonthly}
            benchmarkLabel="Avg"
          />
        </ChartCard>

        <ChartCard title="Category split" subtitle="By classification — Quality / Packaging / Labeling">
          <DonutChart data={k.category} emptyLabel="No classification data" />
        </ChartCard>

        <ChartCard title="Investigation cycle time" subtitle="Closed on or before due date">
          <ComplianceGauge value={k.onTime} target={90} label="On-time closure" caption={`Avg cycle ${k.cycle}d`} />
        </ChartCard>

        <ChartCard title="Complaint-to-CAPA conversion" subtitle="Share of complaints escalated to a CAPA">
          <ComplianceGauge value={k.conversionRate} target={90} label="CAPA conversion" />
        </ChartCard>

        <ChartCard title="By product / site" subtitle="Pareto of complaints by product or site">
          <CategoryParetoChart data={k.productSite} cumulativeLine emptyLabel="No product/site data" />
        </ChartCard>

        <ChartCard title="Regulatory-reportable tracker" subtitle="Open complaints flagged reportable, by due date">
          <CalendarList entries={k.reportableEntries} emptyLabel="No reportable complaints" />
        </ChartCard>
      </div>
    </div>
  );
}
