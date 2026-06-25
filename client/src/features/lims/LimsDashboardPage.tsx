import { Spin } from 'antd';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  LayoutDashboard,
  Activity,
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import {
  useLimsDashboard,
  useLimsTat,
  useLimsWorkload,
  type LimsDashboardKpis,
} from '@/lib/api/limsAnalytics';

type Tone = 'default' | 'emerald' | 'blue' | 'amber' | 'red';

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

  const statusData = data.samples_by_status.map((s) => ({
    name: prettyStatus(s.status),
    key: s.status,
    value: s.count,
  }));

  const analystData = [...(workload?.by_analyst ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((a) => ({ name: a.analyst || 'Unassigned', value: a.count }));

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <LayoutDashboard size={22} className="text-gray-500" />
          LIMS Dashboard
        </h1>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
          <Activity size={12} /> Lab throughput, quality risk and review backlog at a glance.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi label="Samples in Testing" value={k.samples_in_testing} icon={FlaskConical} tone="blue" />
        <Kpi label="Pending Reviews" value={k.pending_reviews} icon={ClipboardCheck} tone={k.pending_reviews > 0 ? 'amber' : 'default'} />
        <Kpi label="Open OOS" value={k.open_oos} icon={AlertTriangle} tone={k.open_oos > 0 ? 'red' : 'default'} />
        <Kpi label="OOS Rate 30d" value={`${k.oos_rate_30d}%`} icon={Percent} tone={k.oos_rate_30d > 0 ? 'amber' : 'default'} />
        <Kpi label="QC Rejects 30d" value={k.qc_rejects_30d} icon={XCircle} tone={k.qc_rejects_30d > 0 ? 'red' : 'default'} />
        <Kpi label="Stability Due Pulls" value={k.stability_due_pulls} icon={CalendarClock} tone={k.stability_due_pulls > 0 ? 'amber' : 'default'} />
        <Kpi label="Equipment Overdue" value={k.equipment_overdue} icon={Wrench} tone={k.equipment_overdue > 0 ? 'red' : 'default'} />
        <Kpi label="Certs Expiring 30d" value={k.certs_expiring_30d} icon={BadgeCheck} tone={k.certs_expiring_30d > 0 ? 'amber' : 'default'} />
        <Kpi label="CoAs Issued" value={k.coas_issued} icon={FileCheck2} tone="emerald" />
      </div>

      {/* TAT cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Turnaround Time</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Avg TAT" value={`${tat?.avg_tat_days ?? 0}d`} icon={Timer} tone="blue" />
          <Kpi label="P90 TAT" value={`${tat?.p90_tat_days ?? 0}d`} icon={Gauge} tone="blue" />
          <Kpi label="Overdue in Testing" value={tat?.overdue_in_testing ?? 0} icon={Hourglass} tone={(tat?.overdue_in_testing ?? 0) > 0 ? 'red' : 'default'} />
          <Kpi label="Released" value={tat?.released_count ?? 0} icon={CheckCircle2} tone="emerald" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Samples by Status</h3>
          {statusData.length === 0 || statusData.every((s) => s.value === 0) ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((s) => (
                    <Cell key={s.key} fill={statusFill(s.key)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Workload by Analyst</h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Users size={12} />
              {workload?.open_worklists ?? 0} open worklists
            </span>
          </div>
          {analystData.length === 0 || analystData.every((a) => a.value === 0) ? (
            <Empty text="No active worklists" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analystData} layout="vertical" margin={{ left: 16 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </PageContainer>
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
  };
  const accentCls: Record<Tone, string> = {
    default: 'bg-gray-100 text-gray-500',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${valueCls[tone]}`}>{value}</div>
      </div>
      <span className={`shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg ${accentCls[tone]}`}>
        <Icon size={18} />
      </span>
    </div>
  );
}

function Empty({ text = 'No data' }: { text?: string }) {
  return <div className="py-12 text-center text-sm text-gray-400">{text}</div>;
}
