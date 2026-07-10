import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Spin, Select } from 'antd';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  ClipboardCheck,
  CheckCircle2,
  Activity,
  AlertTriangle,
  FileWarning,
  Wrench,
  ListChecks,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuditDashboard, type AuditDashboardFilters } from '@/lib/api/audit';
import { FindingSeverityBadge } from './auditStatusBadge';

const SEVERITY_ORDER = ['OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL'];
const SEVERITY_FILL: Record<string, string> = {
  OBSERVATION: '#3b82f6',
  MINOR: '#f59e0b',
  MAJOR: '#f97316',
  CRITICAL: '#ef4444',
};

const CAPA_TYPE_FILL: Record<string, string> = {
  CORRECTIVE: '#3b82f6',
  PREVENTIVE: '#8b5cf6',
  BOTH: '#06b6d4',
};

const STATUS_FILL: Record<string, string> = {
  OPEN: '#3b82f6',
  DRAFT: '#94a3b8',
  IN_PROGRESS: '#f59e0b',
  PENDING_APPROVAL: '#f59e0b',
  PENDING: '#f59e0b',
  INVESTIGATION: '#8b5cf6',
  IMPLEMENTATION: '#06b6d4',
  CAPA_RAISED: '#8b5cf6',
  APPROVED: '#6366f1',
  VERIFIED: '#10b981',
  COMPLETED: '#22c55e',
  CLOSED: '#22c55e',
  DONE: '#22c55e',
  REJECTED: '#ef4444',
  CANCELLED: '#ef4444',
  OVERDUE: '#ef4444',
};
const FALLBACK_PALETTE = ['#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f97316', '#64748b'];

const TT_STYLE = {
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  fontSize: '11px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  padding: '6px 10px',
  backgroundColor: '#fff',
};

const prettyStatus = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function toSlices(map: Record<string, number>, fill: Record<string, string> = STATUS_FILL) {
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value], i) => ({
      name: prettyStatus(name),
      value,
      color: fill[name] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    }))
    .sort((a, b) => b.value - a.value);
}

const opts = (values: string[]) =>
  values.map((v) => ({ value: v, label: prettyStatus(v) }));

export default function AuditDashboardPage() {
  const [filters, setFilters] = useState<AuditDashboardFilters>({});
  const { data, isLoading, isFetching } = useAuditDashboard(filters);
  const d = data?.data;

  if (isLoading || !d) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin />
      </div>
    );
  }

  const k = d.kpis;
  const fo = d.filter_options;
  const activeFilters = Object.values(filters).filter(Boolean).length;

  const sevData = SEVERITY_ORDER.map((s) => ({
    name: s[0] + s.slice(1).toLowerCase(),
    key: s,
    value: d.findings_by_severity[s] ?? 0,
  }));

  const ncs = toSlices(d.ncs_by_status);
  const capas = toSlices(d.capas_by_status);
  const capaTypes = toSlices(d.capas_by_type, CAPA_TYPE_FILL);
  const actions = toSlices(d.actions_by_status);
  const registers = toSlices(d.registers_by_status);
  const programs = toSlices(d.programs_by_status);
  const ncsByDept = d.ncs_by_department.map((x, i) => ({
    ...x,
    color: FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
  }));

  const set = (key: keyof AuditDashboardFilters) => (v?: string) =>
    setFilters((f) => ({ ...f, [key]: v || undefined }));

  return (
    <div className="space-y-4">
      {/* Header + dynamic filter bar */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Audit Dashboard</h2>
          <p className="text-xs text-gray-500">Programme health, findings, CAPA and action tracking</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
            <SlidersHorizontal size={13} /> Filters
            {isFetching && <Spin size="small" className="ml-1" />}
          </span>
          <Select
            size="small" allowClear placeholder="Financial Year" style={{ width: 150 }}
            value={filters.financialYear} onChange={set('financialYear')}
            options={opts(fo.financial_years)}
          />
          <Select
            size="small" allowClear placeholder="Site / Plant" style={{ width: 150 }}
            value={filters.plant} onChange={set('plant')}
            options={opts(fo.plants)}
          />
          <Select
            size="small" allowClear placeholder="Audit Type" style={{ width: 160 }}
            value={filters.auditType} onChange={set('auditType')}
            options={opts(fo.audit_types)}
          />
          <Select
            size="small" allowClear placeholder="Status" style={{ width: 150 }}
            value={filters.status} onChange={set('status')}
            options={opts(fo.statuses)}
          />
          {activeFilters > 0 && (
            <button
              onClick={() => setFilters({})}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md px-2 py-1"
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* KPI strip — all key indicators in one line on wide screens */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Kpi icon={<ClipboardCheck size={16} />} label="Total Audits" value={k.total_audits} tone="slate" />
        <Kpi icon={<CheckCircle2 size={16} />} label="Completion" value={`${k.completion_rate}%`} sub={`${k.completed_audits} done`} tone="emerald" />
        <Kpi icon={<Activity size={16} />} label="In Progress" value={k.in_progress_audits} tone="blue" />
        <Kpi icon={<AlertTriangle size={16} />} label="Open Findings" value={k.open_findings} tone="amber" />
        <Kpi icon={<FileWarning size={16} />} label="Open NCs" value={k.open_ncs} sub={k.overdue_ncs ? `${k.overdue_ncs} overdue` : undefined} tone={k.overdue_ncs ? 'red' : 'slate'} />
        <Kpi icon={<Wrench size={16} />} label="Open CAPAs" value={k.open_capas} sub={k.overdue_capas ? `${k.overdue_capas} overdue` : undefined} tone={k.overdue_capas ? 'red' : 'slate'} />
        <Kpi icon={<ListChecks size={16} />} label="Open Actions" value={k.open_actions} sub={k.overdue_actions ? `${k.overdue_actions} overdue` : undefined} tone={k.overdue_actions ? 'red' : 'slate'} />
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Audit Trend" subtitle="Planned vs completed — last 6 months">
          {d.monthly_trend.some((t) => t.planned || t.completed) ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={d.monthly_trend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="planned" name="Planned" stroke="#3b82f6" fill="url(#gPlanned)" strokeWidth={2} />
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" fill="url(#gCompleted)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Panel>

        <Panel title="Findings Trend" subtitle="Findings raised — last 6 months">
          {d.findings_trend.some((t) => t.findings) ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={d.findings_trend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gFind" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Area type="monotone" dataKey="findings" name="Findings" stroke="#f59e0b" fill="url(#gFind)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Panel>
      </div>

      {/* Findings severity + NC pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Findings by Severity">
          {sevData.every((s) => s.value === 0) ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sevData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="value" name="Findings" radius={[4, 4, 0, 0]}>
                  {sevData.map((s) => (
                    <Cell key={s.key} fill={SEVERITY_FILL[s.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Non-Conformances by Status">
          <Donut data={ncs} />
        </Panel>
      </div>

      {/* CAPA analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="CAPAs by Status">
          <Donut data={capas} />
        </Panel>
        <Panel title="CAPAs by Type" subtitle="Corrective vs Preventive">
          <Donut data={capaTypes} />
        </Panel>
      </div>

      {/* Actions + NC by department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Action Items by Status">
          <Donut data={actions} />
        </Panel>
        <Panel title="Non-Conformances by Department" subtitle="Top 8">
          <HBar data={ncsByDept} />
        </Panel>
      </div>

      {/* Registers + programmes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Audit Registers by Status">
          <HBar data={registers} />
        </Panel>
        <Panel title="Programmes by Status">
          <HBar data={programs} />
        </Panel>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Upcoming Audits">
          {d.upcoming_audits.length === 0 ? (
            <Empty text="No upcoming audits scheduled" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {d.upcoming_audits.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                  <Link to={`/audit/register/${a.id}`} className="min-w-0">
                    <div className="text-sm text-gray-900 truncate hover:text-blue-600">{a.title}</div>
                    <div className="text-[11px] font-mono text-gray-500">{a.register_number}</div>
                  </Link>
                  <span className="text-xs text-gray-500 shrink-0">
                    {new Date(a.planned_date).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent Findings">
          {d.recent_findings.length === 0 ? (
            <Empty text="No findings recorded yet" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {d.recent_findings.map((f) => (
                <li key={f.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900 truncate">{f.description}</div>
                    <div className="text-[11px] text-gray-500">
                      <span className="font-mono">{f.finding_number}</span>
                      {f.audit_title ? ` · ${f.audit_title}` : ''}
                    </div>
                  </div>
                  <span className="shrink-0">
                    <FindingSeverityBadge severity={f.severity} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ─── Primitives ──────────────────────────────────────────────────────────────
function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Donut({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  if (data.length === 0) return <Empty />;
  const total = data.reduce((s, x) => s + x.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={2}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TT_STYLE} />
          <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[92px] flex flex-col items-center">
        <div className="text-2xl font-bold text-gray-900 leading-none">{total}</div>
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">Total</div>
      </div>
    </div>
  );
}

function HBar({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={130} />
        <Tooltip contentStyle={TT_STYLE} />
        <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone = 'slate',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: 'slate' | 'emerald' | 'blue' | 'amber' | 'red';
}) {
  const tones: Record<string, { border: string; icon: string; value: string }> = {
    slate:   { border: 'border-l-slate-300',   icon: 'bg-slate-100 text-slate-600',     value: 'text-gray-900' },
    emerald: { border: 'border-l-emerald-400', icon: 'bg-emerald-50 text-emerald-600',  value: 'text-emerald-600' },
    blue:    { border: 'border-l-blue-400',    icon: 'bg-blue-50 text-blue-600',        value: 'text-blue-600' },
    amber:   { border: 'border-l-amber-400',   icon: 'bg-amber-50 text-amber-600',      value: 'text-amber-600' },
    red:     { border: 'border-l-red-400',     icon: 'bg-red-50 text-red-600',          value: 'text-red-600' },
  };
  const t = tones[tone];
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-[3px] ${t.border} p-3.5`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.icon}`}>{icon}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wide leading-tight">{label}</span>
      </div>
      <div className={`text-2xl font-bold leading-none ${t.value}`}>{value}</div>
      {sub && <div className={`text-[11px] mt-1 ${tone === 'red' ? 'text-red-500' : 'text-gray-400'}`}>{sub}</div>}
    </div>
  );
}

function Empty({ text = 'No data yet' }: { text?: string }) {
  return <div className="py-16 text-center text-sm text-gray-400">{text}</div>;
}
