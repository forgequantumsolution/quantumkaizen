import { useState } from 'react';
import { Spin } from 'antd';
import {
  FlaskConical,
  ClipboardCheck,
  AlertTriangle,
  Percent,
  XCircle,
  CalendarClock,
  Wrench,
  BadgeCheck,
  FileCheck2,
  Timer,
  Gauge,
  Hourglass,
  CheckCircle2,
  Users,
  ShieldAlert,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import D3BarChart, { type BarDatum } from './D3BarChart';
import {
  useLimsDashboard,
  useLimsTat,
  useLimsWorkload,
  type LimsDashboardKpis,
} from '@/lib/api/limsAnalytics';

type Tone = 'default' | 'emerald' | 'blue' | 'amber' | 'red' | 'indigo';

const STATUS_FILL: Record<string, string> = {
  REGISTERED: '#94a3b8',
  IN_TESTING: '#3b82f6',
  IN_REVIEW: '#f59e0b',
  RELEASED: '#10b981',
  REJECTED: '#ef4444',
  CANCELLED: '#cbd5e1',
};
const statusFill = (s: string) => STATUS_FILL[s] ?? '#6366f1';
const prettyStatus = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function LimsDashboardPage() {
  const { data, isLoading } = useLimsDashboard();
  const { data: tat } = useLimsTat();
  const { data: workload } = useLimsWorkload();
  const [showAll, setShowAll] = useState(false);

  if (isLoading || !data) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const k: LimsDashboardKpis = data.kpis;

  // All chart data below is derived live from the API responses — nothing static.
  const statusData: BarDatum[] = data.samples_by_status.map((s) => ({
    label: prettyStatus(s.status),
    value: s.count,
    color: statusFill(s.status),
  }));

  const analystData: BarDatum[] = [...(workload?.by_analyst ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((a) => ({ label: a.analyst || 'Unassigned', value: a.count }));

  // Quality & risk indicators — one comparative bar chart replacing a wall of cards.
  const riskData: BarDatum[] = [
    { label: 'Open OOS', value: k.open_oos, color: '#ef4444' },
    { label: 'QC Rejects', value: k.qc_rejects_30d, color: '#f97316' },
    { label: 'Stability Due', value: k.stability_due_pulls, color: '#f59e0b' },
    { label: 'Equip. Overdue', value: k.equipment_overdue, color: '#ec4899' },
    { label: 'Certs Expiring', value: k.certs_expiring_30d, color: '#8b5cf6' },
  ];

  const tatData: BarDatum[] = [
    { label: 'Avg TAT', value: tat?.avg_tat_days ?? 0, color: '#3b82f6' },
    { label: 'P90 TAT', value: tat?.p90_tat_days ?? 0, color: '#6366f1' },
    { label: 'Overdue', value: tat?.overdue_in_testing ?? 0, color: '#ef4444' },
  ];

  return (
    <PageContainer>
      {/* Key KPI strip — one line */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Key Metrics</h3>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-colors"
          >
            {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAll ? 'Show less' : 'Show all metrics'}
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          <Kpi label="Samples in Testing" value={k.samples_in_testing} icon={FlaskConical} tone="blue" />
          <Kpi label="Pending Reviews" value={k.pending_reviews} icon={ClipboardCheck} tone={k.pending_reviews > 0 ? 'amber' : 'default'} />
          <Kpi label="Open OOS" value={k.open_oos} icon={AlertTriangle} tone={k.open_oos > 0 ? 'red' : 'default'} />
          <Kpi label="OOS Rate 30d" value={`${k.oos_rate_30d}%`} icon={Percent} tone={k.oos_rate_30d > 0 ? 'amber' : 'default'} />
          <Kpi label="CoAs Issued" value={k.coas_issued} icon={FileCheck2} tone="emerald" />
        </div>

        {/* Secondary metrics — revealed by the toggle */}
        {showAll && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mt-3">
            <Kpi label="QC Rejects 30d" value={k.qc_rejects_30d} icon={XCircle} tone={k.qc_rejects_30d > 0 ? 'red' : 'default'} />
            <Kpi label="Stability Due Pulls" value={k.stability_due_pulls} icon={CalendarClock} tone={k.stability_due_pulls > 0 ? 'amber' : 'default'} />
            <Kpi label="Equipment Overdue" value={k.equipment_overdue} icon={Wrench} tone={k.equipment_overdue > 0 ? 'red' : 'default'} />
            <Kpi label="Certs Expiring 30d" value={k.certs_expiring_30d} icon={BadgeCheck} tone={k.certs_expiring_30d > 0 ? 'amber' : 'default'} />
            <Kpi label="Avg TAT" value={`${tat?.avg_tat_days ?? 0}d`} icon={Timer} tone="blue" />
            <Kpi label="P90 TAT" value={`${tat?.p90_tat_days ?? 0}d`} icon={Gauge} tone="blue" />
            <Kpi label="Overdue in Testing" value={tat?.overdue_in_testing ?? 0} icon={Hourglass} tone={(tat?.overdue_in_testing ?? 0) > 0 ? 'red' : 'default'} />
            <Kpi label="Released" value={tat?.released_count ?? 0} icon={CheckCircle2} tone="emerald" />
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Samples by Status" icon={FlaskConical}>
          {statusData.length === 0 || statusData.every((s) => s.value === 0) ? (
            <Empty />
          ) : (
            <D3BarChart id="samples-status" data={statusData} />
          )}
        </ChartCard>

        <ChartCard
          title="Workload by Analyst"
          icon={Users}
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Users size={12} />
              {workload?.open_worklists ?? 0} open worklists
            </span>
          }
        >
          {analystData.length === 0 || analystData.every((a) => a.value === 0) ? (
            <Empty text="No active worklists" />
          ) : (
            <D3BarChart id="workload-analyst" data={analystData} orientation="horizontal" baseColor="#6366f1" />
          )}
        </ChartCard>

        <ChartCard title="Quality & Risk Indicators" icon={ShieldAlert}>
          {riskData.every((r) => r.value === 0) ? (
            <Empty text="No open quality risks" />
          ) : (
            <D3BarChart id="quality-risk" data={riskData} />
          )}
        </ChartCard>

        <ChartCard title="Turnaround Time" icon={Clock}>
          {tatData.every((t) => t.value === 0) ? (
            <Empty text="No turnaround data yet" />
          ) : (
            <D3BarChart id="tat" data={tatData} valueSuffix="d" />
          )}
        </ChartCard>
      </div>
    </PageContainer>
  );
}

function ChartCard({
  title,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Icon size={15} className="text-gray-400" />
          {title}
        </h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const valueCls: Record<Tone, string> = {
    default: 'text-gray-900',
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    indigo: 'text-indigo-600',
  };
  const accentCls: Record<Tone, string> = {
    default: 'bg-gray-100 text-gray-500',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="flex-1 min-w-[168px] bg-white rounded-xl border border-gray-200 p-3.5 flex items-center gap-3 hover:shadow-sm hover:border-gray-300 transition-all">
      <span className={`shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-lg ${accentCls[tone]}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className={`text-2xl font-semibold leading-none ${valueCls[tone]}`}>{value}</div>
        <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function Empty({ text = 'No data' }: { text?: string }) {
  return <div className="py-16 text-center text-sm text-gray-400">{text}</div>;
}
