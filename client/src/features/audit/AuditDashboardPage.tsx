import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spin, Select, Popover } from 'antd';
import {
  ClipboardCheck,
  CheckCircle2,
  Activity,
  AlertTriangle,
  FileWarning,
  Wrench,
  ListChecks,
  RotateCcw,
  Filter as FilterIcon,
} from 'lucide-react';
import { useAuditDashboard, type AuditDashboardFilters } from '@/lib/api/audit';
import { FindingSeverityBadge } from './auditStatusBadge';
import {
  ChartCard,
  DonutChart,
  HBarSplit,
  BarSplit,
  TrendLineChart,
  CalendarList,
  EmptyChart,
  type Slice,
} from '@/components/analytics';
import { KpiCard } from '@/components/ui';

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

const prettyStatus = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function toSlices(map: Record<string, number>, fill: Record<string, string> = STATUS_FILL): Slice[] {
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([name, value], i) => ({
      name: prettyStatus(name),
      value,
      color: fill[name] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    }))
    .sort((a, b) => b.value - a.value);
}

const opts = (values: string[]) => values.map((v) => ({ value: v, label: prettyStatus(v) }));

export default function AuditDashboardPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AuditDashboardFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
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

  const sevSlices: Slice[] = SEVERITY_ORDER.map((s) => ({
    name: s[0] + s.slice(1).toLowerCase(),
    value: d.findings_by_severity[s] ?? 0,
    color: SEVERITY_FILL[s],
  }));

  const ncs = toSlices(d.ncs_by_status);
  const capas = toSlices(d.capas_by_status);
  const capaTypes = toSlices(d.capas_by_type, CAPA_TYPE_FILL);
  const actions = toSlices(d.actions_by_status);
  const registers = toSlices(d.registers_by_status);
  const programs = toSlices(d.programs_by_status);
  const ncsByDept: Slice[] = d.ncs_by_department.map((x, i) => ({
    name: x.name,
    value: x.value,
    color: FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
  }));

  const set = (key: keyof AuditDashboardFilters) => (v?: string) =>
    setFilters((f) => ({ ...f, [key]: v || undefined }));

  const filterContent = (
    <div className="w-[240px] space-y-3">
      <Field label="Financial Year">
        <Select size="small" allowClear placeholder="Any year" style={{ width: '100%' }}
          value={filters.financialYear} onChange={set('financialYear')} options={opts(fo.financial_years)} />
      </Field>
      <Field label="Site / Plant">
        <Select size="small" allowClear placeholder="Any site" style={{ width: '100%' }}
          value={filters.plant} onChange={set('plant')} options={opts(fo.plants)} />
      </Field>
      <Field label="Audit Type">
        <Select size="small" allowClear placeholder="Any type" style={{ width: '100%' }}
          value={filters.auditType} onChange={set('auditType')} options={opts(fo.audit_types)} />
      </Field>
      <Field label="Status">
        <Select size="small" allowClear placeholder="Any status" style={{ width: '100%' }}
          value={filters.status} onChange={set('status')} options={opts(fo.statuses)} />
      </Field>
      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
        <button type="button" onClick={() => setFilters({})} disabled={activeFilters === 0}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-500 hover:text-gray-900 disabled:opacity-40">
          <RotateCcw size={12} /> Clear all
        </button>
        <button type="button" onClick={() => setFilterOpen(false)}
          className="rounded-md bg-gray-900 px-3 py-1 text-[12px] font-semibold text-white hover:bg-gray-700">
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header + right-aligned Filter popover */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Audit Dashboard</h2>
          <p className="text-xs text-gray-500">Programme health, findings, CAPA and action tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Spin size="small" />}
          <Popover open={filterOpen} onOpenChange={setFilterOpen} trigger="click" placement="bottomRight" content={filterContent}>
            <button type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-900">
              <FilterIcon size={14} /> Filter
              {activeFilters > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-white">
                  {activeFilters}
                </span>
              )}
            </button>
          </Popover>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard icon={ClipboardCheck} label="Total Audits" value={k.total_audits} accent="slate" onClick={() => navigate('/audit/register')} />
        <KpiCard icon={CheckCircle2} label="Completion" value={`${k.completion_rate}%`} subtitle={`${k.completed_audits} done`} accent="emerald" onClick={() => navigate('/audit/register')} />
        <KpiCard icon={Activity} label="In Progress" value={k.in_progress_audits} accent="blue" onClick={() => navigate('/audit/register')} />
        <KpiCard icon={AlertTriangle} label="Open Findings" value={k.open_findings} accent="amber" onClick={() => navigate('/audit/register')} />
        <KpiCard icon={FileWarning} label="Open NCs" value={k.open_ncs} subtitle={k.overdue_ncs ? `${k.overdue_ncs} overdue` : undefined} accent={k.overdue_ncs ? 'red' : 'slate'} onClick={() => navigate('/audit/non-conformance')} />
        <KpiCard icon={Wrench} label="Open CAPAs" value={k.open_capas} subtitle={k.overdue_capas ? `${k.overdue_capas} overdue` : undefined} accent={k.overdue_capas ? 'red' : 'slate'} onClick={() => navigate('/audit/capa')} />
        <KpiCard icon={ListChecks} label="Open Actions" value={k.open_actions} subtitle={k.overdue_actions ? `${k.overdue_actions} overdue` : undefined} accent={k.overdue_actions ? 'red' : 'slate'} onClick={() => navigate('/audit/register')} />
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Audit Trend" subtitle="Planned vs completed — last 6 months">
          <TrendLineChart
            data={d.monthly_trend as unknown as Array<Record<string, string | number>>}
            series={[
              { key: 'planned', name: 'Planned', color: '#3b82f6' },
              { key: 'completed', name: 'Completed', color: '#22c55e' },
            ]}
            emptyLabel="No audits scheduled yet"
          />
        </ChartCard>
        <ChartCard title="Findings Trend" subtitle="Findings raised — last 6 months">
          <TrendLineChart
            data={d.findings_trend as unknown as Array<Record<string, string | number>>}
            series={[{ key: 'findings', name: 'Findings', color: '#f59e0b' }]}
            emptyLabel="No findings recorded yet"
          />
        </ChartCard>
      </div>

      {/* Findings severity + NC pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Findings by Severity" subtitle="Observation → Critical">
          <BarSplit data={sevSlices} valueLabel="Findings" emptyLabel="No findings recorded yet" />
        </ChartCard>
        <ChartCard title="Non-Conformances by Status">
          <DonutChart data={ncs} emptyLabel="No non-conformances yet" />
        </ChartCard>
      </div>

      {/* CAPA analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="CAPAs by Status">
          <DonutChart data={capas} emptyLabel="No CAPAs yet" />
        </ChartCard>
        <ChartCard title="CAPAs by Type" subtitle="Corrective vs Preventive">
          <DonutChart data={capaTypes} emptyLabel="No CAPAs yet" />
        </ChartCard>
      </div>

      {/* Actions + NC by department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Action Items by Status">
          <DonutChart data={actions} emptyLabel="No action items yet" />
        </ChartCard>
        <ChartCard title="Non-Conformances by Department" subtitle="Top 8">
          <HBarSplit data={ncsByDept} valueLabel="NCs" width={140} emptyLabel="No non-conformances yet" />
        </ChartCard>
      </div>

      {/* Registers + programmes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Audit Registers by Status">
          <HBarSplit data={registers} width={150} emptyLabel="No registers yet" />
        </ChartCard>
        <ChartCard title="Programmes by Status">
          <HBarSplit data={programs} width={150} emptyLabel="No programmes yet" />
        </ChartCard>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Upcoming Audits" subtitle="Scheduled, soonest first">
          <CalendarList
            entries={d.upcoming_audits.map((a) => ({
              id: a.id,
              title: a.title,
              meta: a.register_number,
              date: a.planned_date,
            }))}
            emptyLabel="No upcoming audits scheduled"
          />
        </ChartCard>

        <ChartCard title="Recent Findings" subtitle="Latest raised">
          {d.recent_findings.length === 0 ? (
            <EmptyChart label="No findings recorded yet" />
          ) : (
            <ul className="divide-y divide-gray-100 overflow-auto" style={{ maxHeight: 260 }}>
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
        </ChartCard>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}
