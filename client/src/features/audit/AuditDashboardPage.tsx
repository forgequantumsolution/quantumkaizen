import { Link } from 'react-router-dom';
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
import { useAuditDashboard } from '@/lib/api/audit';
import { FindingSeverityBadge } from './auditStatusBadge';

const SEVERITY_ORDER = ['OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL'];
const SEVERITY_FILL: Record<string, string> = {
  OBSERVATION: '#3b82f6',
  MINOR: '#f59e0b',
  MAJOR: '#f97316',
  CRITICAL: '#ef4444',
};

export default function AuditDashboardPage() {
  const { data, isLoading } = useAuditDashboard();
  const d = data?.data;

  if (isLoading || !d) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin />
      </div>
    );
  }

  const k = d.kpis;
  const sevData = SEVERITY_ORDER.map((s) => ({
    name: s[0] + s.slice(1).toLowerCase(),
    key: s,
    value: d.findings_by_severity[s] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Audit Dashboard</h2>
        <p className="text-xs text-gray-500">Programme health, findings, CAPA and action tracking</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Total Audits" value={k.total_audits} />
        <Kpi label="Completion" value={`${k.completion_rate}%`} sub={`${k.completed_audits} done`} tone="emerald" />
        <Kpi label="In Progress" value={k.in_progress_audits} tone="blue" />
        <Kpi label="Open Findings" value={k.open_findings} tone="amber" />
        <Kpi label="Open NCs" value={k.open_ncs} sub={k.overdue_ncs ? `${k.overdue_ncs} overdue` : undefined} tone={k.overdue_ncs ? 'red' : 'default'} />
        <Kpi label="Open CAPAs" value={k.open_capas} sub={k.overdue_capas ? `${k.overdue_capas} overdue` : undefined} tone={k.overdue_capas ? 'red' : 'default'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Open Actions" value={k.open_actions} sub={k.overdue_actions ? `${k.overdue_actions} overdue` : undefined} tone={k.overdue_actions ? 'red' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Findings by severity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Findings by Severity</h3>
          {sevData.every((s) => s.value === 0) ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sevData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {sevData.map((s) => (
                    <Cell key={s.key} fill={SEVERITY_FILL[s.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status breakdowns */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Pipeline</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <StatusList title="Non-Conformances" map={d.ncs_by_status} />
            <StatusList title="CAPAs" map={d.capas_by_status} />
            <StatusList title="Audit Registers" map={d.registers_by_status} />
            <StatusList title="Action Items" map={d.actions_by_status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming audits */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Upcoming Audits</h3>
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
        </div>

        {/* Recent findings */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Findings</h3>
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
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: 'default' | 'emerald' | 'blue' | 'amber' | 'red';
}) {
  const toneCls: Record<string, string> = {
    default: 'text-gray-900',
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusList({ title, map }: { title: string; map: Record<string, number> }) {
  const entries = Object.entries(map).filter(([, v]) => v > 0);
  return (
    <div>
      <div className="text-[11px] font-medium text-gray-600 uppercase tracking-wide mb-1.5">{title}</div>
      {entries.length === 0 ? (
        <div className="text-xs text-gray-400">—</div>
      ) : (
        <ul className="space-y-1">
          {entries.map(([s, v]) => (
            <li key={s} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{s.replace(/_/g, ' ')}</span>
              <span className="font-medium text-gray-900">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty({ text = 'No data' }: { text?: string }) {
  return <div className="py-10 text-center text-sm text-gray-400">{text}</div>;
}
