import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  ShieldAlert,
  Eye,
  Clock,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { FilterPresetBar } from '@/components/shared/FilterPresetBar';
import { exportToCSV } from '@/lib/export';
import {
  Card,
  Button,
  DataTable,
  StatsCard,
  StatusBadge,
  SeverityBadge,
  Badge,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { cn, formatDate, daysSince } from '@/lib/utils';
import { useCAPAs, mockCAPAs } from './hooks';
import { useFiscalYearStore } from '@/stores/fiscalYearStore';
import type { CAPARecord } from './hooks';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const STATUSES = [
  '',
  'INITIATED',
  'CONTAINMENT',
  'ROOT_CAUSE_ANALYSIS',
  'ACTION_DEFINITION',
  'IMPLEMENTATION',
  'EFFECTIVENESS_VERIFICATION',
  'CLOSED',
];
const SEVERITIES = ['', 'CRITICAL', 'MAJOR', 'MINOR'];
const SOURCES = ['', 'NC', 'AUDIT', 'COMPLAINT', 'PROACTIVE', 'MANAGEMENT', 'CUSTOMER'];
const DEPARTMENTS = ['', 'Quality Assurance', 'Quality Control', 'Production', 'Engineering', 'HSE'];

const sourceBadgeVariant: Record<string, 'danger' | 'info' | 'warning' | 'purple' | 'default' | 'success'> = {
  NC: 'danger',
  AUDIT: 'info',
  COMPLAINT: 'warning',
  PROACTIVE: 'success',
  MANAGEMENT: 'purple',
  CUSTOMER: 'warning',
};

export default function CAPAListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      source: sourceFilter || undefined,
      department: deptFilter || undefined,
      search: search || undefined,
    }),
    [statusFilter, severityFilter, sourceFilter, deptFilter, search],
  );

  const { year } = useFiscalYearStore();
  const { data: result, isLoading } = useCAPAs(filters);
  const capas = (result?.data ?? []).filter((c) => new Date(c.createdAt).getFullYear() === year);

  const yearCAPAs = useMemo(() => mockCAPAs.filter((c) => new Date(c.createdAt).getFullYear() === year), [year]);

  const openCount = yearCAPAs.filter((c) =>
    ['INITIATED', 'CONTAINMENT', 'ROOT_CAUSE_ANALYSIS', 'ACTION_DEFINITION'].includes(c.status),
  ).length;
  const investigationCount = yearCAPAs.filter((c) =>
    ['ROOT_CAUSE_ANALYSIS', 'ACTION_DEFINITION'].includes(c.status),
  ).length;
  const overdueCount = yearCAPAs.filter(
    (c) => new Date(c.dueDate) < new Date() && c.status !== 'CLOSED',
  ).length;
  const closedThisMonth = yearCAPAs.filter((c) => {
    if (!c.closedAt) return false;
    const d = new Date(c.closedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const columns: Column<CAPARecord>[] = [
    {
      key: 'capaNumber',
      header: 'CAPA Number',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">{row.capaNumber}</span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <span className="block max-w-xs truncate font-medium text-slate-900">{row.title}</span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => (
        <Badge variant={sourceBadgeVariant[row.source] || 'default'}>{row.source}</Badge>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => <span className="text-slate-600">{row.owner}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => {
        const overdue = new Date(row.dueDate) < new Date() && row.status !== 'CLOSED';
        return (
          <span className={cn('text-sm', overdue && 'font-semibold text-red-600')}>
            {formatDate(row.dueDate)}
          </span>
        );
      },
    },
    {
      key: 'age',
      header: 'Age (days)',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{daysSince(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CAPA Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Corrective and preventive actions for continuous improvement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV('capas', ['CAPA #', 'Title', 'Priority', 'Status', 'Owner', 'Due Date'], capas.map(c => [c.capaNumber, c.title, c.severity, c.status, c.owner, c.dueDate?.slice(0, 10) || '']))}>
            <Download size={14} />
            Export CSV
          </Button>
          <Button onClick={() => navigate('/qms/capa/new')}>
            <Plus className="h-4 w-4" />
            Initiate CAPA
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Open CAPAs"
          value={openCount}
          icon={ShieldAlert}
          iconColor="bg-amber-50 text-amber-600"
          onClick={() => setStatusFilter('INITIATED')}
        />
        <StatsCard
          title="Under Investigation"
          value={investigationCount}
          icon={Eye}
          iconColor="bg-sky-50 text-sky-600"
          onClick={() => setStatusFilter('ROOT_CAUSE_ANALYSIS')}
        />
        <StatsCard
          title="Overdue"
          value={overdueCount}
          icon={Clock}
          iconColor="bg-red-50 text-red-600"
          onClick={() => setStatusFilter('IMPLEMENTATION')}
        />
        <StatsCard
          title="Closed This Month"
          value={closedThisMonth}
          icon={CheckCircle2}
          iconColor="bg-emerald-50 text-emerald-600"
          onClick={() => setStatusFilter('CLOSED')}
        />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Stage Pipeline</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { stage: 'Initiated', count: yearCAPAs.filter((c) => c.status === 'INITIATED').length },
              { stage: 'Containment', count: yearCAPAs.filter((c) => c.status === 'CONTAINMENT').length },
              { stage: 'Root Cause', count: yearCAPAs.filter((c) => c.status === 'ROOT_CAUSE_ANALYSIS').length },
              { stage: 'Action Def.', count: yearCAPAs.filter((c) => c.status === 'ACTION_DEFINITION').length },
              { stage: 'Implement.', count: yearCAPAs.filter((c) => c.status === 'IMPLEMENTATION').length },
              { stage: 'Verify', count: yearCAPAs.filter((c) => c.status === 'EFFECTIVENESS_VERIFICATION').length },
              { stage: 'Closed', count: yearCAPAs.filter((c) => c.status === 'CLOSED').length },
            ]} layout="vertical" margin={{ left: 4 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 10 }} width={62} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="#0D0E17" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">By Source</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={[
                  { name: 'NC', value: yearCAPAs.filter((c) => c.source === 'NC').length },
                  { name: 'Audit', value: yearCAPAs.filter((c) => c.source === 'AUDIT').length },
                  { name: 'Complaint', value: yearCAPAs.filter((c) => c.source === 'COMPLAINT').length },
                  { name: 'Proactive', value: yearCAPAs.filter((c) => c.source === 'PROACTIVE').length },
                  { name: 'Other', value: yearCAPAs.filter((c) => !['NC','AUDIT','COMPLAINT','PROACTIVE'].includes(c.source)).length },
                ]}
                cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value"
              >
                {['#EF4444','#3B82F6','#F59E0B','#22C55E','#A855F7'].map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {[{ l: 'NC', c: '#EF4444' }, { l: 'Audit', c: '#3B82F6' }, { l: 'Complaint', c: '#F59E0B' }, { l: 'Proactive', c: '#22C55E' }, { l: 'Other', c: '#A855F7' }].map(({ l, c }) => (
              <div key={l} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-[10px] text-slate-500">{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Age Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { range: '0–7d', count: yearCAPAs.filter((c) => { const d = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000); return d <= 7; }).length },
              { range: '8–30d', count: yearCAPAs.filter((c) => { const d = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000); return d > 7 && d <= 30; }).length },
              { range: '31–90d', count: yearCAPAs.filter((c) => { const d = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000); return d > 30 && d <= 90; }).length },
              { range: '90d+', count: yearCAPAs.filter((c) => { const d = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000); return d > 90; }).length },
            ]}>
              <XAxis dataKey="range" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={22} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="#F59E0B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search CAPAs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Severities</option>
            {SEVERITIES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Sources</option>
            {SOURCES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.filter(Boolean).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <FilterPresetBar
          module="capa"
          currentFilters={{ status: statusFilter, severity: severityFilter, source: sourceFilter, department: deptFilter }}
          onApplyPreset={(f) => {
            setStatusFilter(f.status ?? '');
            setSeverityFilter(f.severity ?? '');
            setSourceFilter(f.source ?? '');
            setDeptFilter(f.department ?? '');
          }}
        />
      </Card>

      {/* Table */}
      <Card noPadding>
        <DataTable
          columns={columns}
          data={capas}
          isLoading={isLoading}
          selectable
          bulkActions={[
            { label: 'Export selected', action: 'export' },
            { label: 'Assign owner', action: 'assign' },
            { label: 'Close selected', action: 'close', variant: 'danger' as const },
          ]}
          onBulkAction={(action, rows) => {
            if (action === 'export') {
              exportToCSV('capa-selected', ['CAPA #', 'Title', 'Severity', 'Status'], rows.map(r => [r.capaNumber, r.title, r.severity, r.status]));
            }
            // others are UI only for now
          }}
          onRowClick={(row) => navigate(`/qms/capa/${row.id}`)}
          rowClassName={(row) => {
            const overdue = new Date(row.dueDate) < new Date() && row.status !== 'CLOSED';
            return overdue ? 'bg-red-50/40' : '';
          }}
          emptyMessage="No CAPAs match your filters"
        />
      </Card>
    </div>
  );
}
