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
import type { CAPARecord } from './hooks';

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

  const { data: result, isLoading } = useCAPAs(filters);
  const capas = result?.data ?? [];

  const openCount = mockCAPAs.filter((c) =>
    ['INITIATED', 'CONTAINMENT', 'ROOT_CAUSE_ANALYSIS', 'ACTION_DEFINITION'].includes(c.status),
  ).length;
  const investigationCount = mockCAPAs.filter((c) =>
    ['ROOT_CAUSE_ANALYSIS', 'ACTION_DEFINITION'].includes(c.status),
  ).length;
  const overdueCount = mockCAPAs.filter(
    (c) => new Date(c.dueDate) < new Date() && c.status !== 'CLOSED',
  ).length;
  const closedThisMonth = mockCAPAs.filter((c) => {
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
        />
        <StatsCard
          title="Under Investigation"
          value={investigationCount}
          icon={Eye}
          iconColor="bg-sky-50 text-sky-600"
        />
        <StatsCard
          title="Overdue"
          value={overdueCount}
          icon={Clock}
          iconColor="bg-red-50 text-red-600"
        />
        <StatsCard
          title="Closed This Month"
          value={closedThisMonth}
          icon={CheckCircle2}
          iconColor="bg-emerald-50 text-emerald-600"
        />
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
