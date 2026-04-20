import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, AlertTriangle, Eye, Clock, CheckCircle2, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import {
  Card,
  Button,
  DataTable,
  StatsCard,
  StatusBadge,
  SeverityBadge,
  TypeBadge,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import type { NonConformance } from '@/types';
import { cn, formatDate, daysSince } from '@/lib/utils';
import { useNonConformances, mockNCs } from './hooks';
import { useFiscalYearStore } from '@/stores/fiscalYearStore';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const STATUSES = ['', 'OPEN', 'CONTAINMENT', 'INVESTIGATION', 'ROOT_CAUSE', 'CAPA_PLANNING', 'CAPA_IMPLEMENTATION', 'CLOSED'];
const SEVERITIES = ['', 'CRITICAL', 'MAJOR', 'MINOR'];
const TYPES = ['', 'DEVIATION', 'PRODUCT_NC', 'PROCESS_NC', 'OOS', 'COMPLAINT'];
const DEPARTMENTS = ['', 'Quality Assurance', 'Quality Control', 'Production', 'Engineering', 'HSE'];

export default function NCListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      type: typeFilter || undefined,
      department: deptFilter || undefined,
      search: search || undefined,
    }),
    [statusFilter, severityFilter, typeFilter, deptFilter, search],
  );

  const { year } = useFiscalYearStore();
  const { data: result, isLoading } = useNonConformances(filters);
  const ncs = (result?.data ?? []).filter((nc) => new Date(nc.createdAt).getFullYear() === year);

  const yearNCs = useMemo(() => mockNCs.filter((n) => new Date(n.createdAt).getFullYear() === year), [year]);

  // Summary counts (from full mock data for cards)
  const openCount = yearNCs.filter((nc) => nc.status === 'OPEN').length;
  const investigationCount = yearNCs.filter((nc) =>
    ['INVESTIGATION', 'ROOT_CAUSE'].includes(nc.status),
  ).length;
  const overdueCount = yearNCs.filter(
    (nc) => nc.dueDate && new Date(nc.dueDate) < new Date() && nc.status !== 'CLOSED',
  ).length;
  const closedThisMonth = yearNCs.filter((nc) => {
    if (!nc.closedAt) return false;
    const d = new Date(nc.closedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const columns: Column<NonConformance>[] = [
    {
      key: 'ncNumber',
      header: 'NC Number',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">{row.ncNumber}</span>
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
      key: 'type',
      header: 'Type',
      render: (row) => <TypeBadge type={row.type} />,
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
    { key: 'department', header: 'Department' },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (row) => <span className="text-slate-600">{row.assignedTo || '—'}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => {
        const overdue =
          row.dueDate && new Date(row.dueDate) < new Date() && row.status !== 'CLOSED';
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
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Non-Conformances</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track, investigate, and resolve quality non-conformances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV('non-conformances', ['ID', 'Title', 'Severity', 'Status', 'Department', 'Date'], ncs.map(nc => [nc.ncNumber, nc.title, nc.severity, nc.status, nc.department || '', nc.createdAt?.slice(0, 10) || '']))}>
            <Download size={14} />
            Export CSV
          </Button>
          <Button onClick={() => navigate('/qms/non-conformances/new')}>
            <Plus className="h-4 w-4" />
            Report NC
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Open"
          value={openCount}
          icon={AlertTriangle}
          iconColor="bg-amber-50 text-amber-600"
          onClick={() => setStatusFilter('OPEN')}
        />
        <StatsCard
          title="Under Investigation"
          value={investigationCount}
          icon={Eye}
          iconColor="bg-sky-50 text-sky-600"
          onClick={() => setStatusFilter('INVESTIGATION')}
        />
        <StatsCard
          title="Overdue"
          value={overdueCount}
          icon={Clock}
          iconColor="bg-red-50 text-red-600"
          onClick={() => { setStatusFilter(''); }}
        />
        <StatsCard
          title="Closed This Month"
          value={closedThisMonth}
          icon={CheckCircle2}
          iconColor="bg-emerald-50 text-emerald-600"
          onClick={() => setStatusFilter('CLOSED')}
        />
      </div>

      {/* ── Analytics ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">By Severity</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Critical', value: yearNCs.filter((n) => n.severity === 'CRITICAL').length },
                  { name: 'Major', value: yearNCs.filter((n) => n.severity === 'MAJOR').length },
                  { name: 'Minor', value: yearNCs.filter((n) => n.severity === 'MINOR').length },
                ]}
                cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value"
              >
                <Cell fill="#EF4444" /><Cell fill="#F59E0B" /><Cell fill="#94A3B8" />
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-1">
            {[{ label: 'Critical', color: '#EF4444' }, { label: 'Major', color: '#F59E0B' }, { label: 'Minor', color: '#94A3B8' }].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={[
              { month: 'Nov', open: 5, closed: 3 },
              { month: 'Dec', open: 7, closed: 4 },
              { month: 'Jan', open: 6, closed: 5 },
              { month: 'Feb', open: 9, closed: 6 },
              { month: 'Mar', open: 8, closed: 7 },
              { month: 'Apr', open: openCount, closed: closedThisMonth },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={22} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="open" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={2} name="Opened" />
              <Area type="monotone" dataKey="closed" stroke="#22C55E" fill="#DCFCE7" strokeWidth={2} name="Closed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">By Type</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { name: 'Deviation', value: yearNCs.filter((n) => n.type === 'DEVIATION').length },
              { name: 'Product NC', value: yearNCs.filter((n) => n.type === 'PRODUCT_NC').length },
              { name: 'Process NC', value: yearNCs.filter((n) => n.type === 'PROCESS_NC').length },
              { name: 'OOS', value: yearNCs.filter((n) => n.type === 'OOS').length },
              { name: 'Complaint', value: yearNCs.filter((n) => n.type === 'COMPLAINT').length },
            ]} layout="vertical" margin={{ left: 4 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={62} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" fill="#0D0E17" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search NCs..."
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
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Severities</option>
            {SEVERITIES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Types</option>
            {TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.filter(Boolean).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <Card noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={ncs}
            onRowClick={(row) =>
              navigate(`/qms/non-conformances/${(row as unknown as NonConformance).id}`)
            }
            rowClassName={(row) => {
              const nc = row as unknown as NonConformance;
              const overdue =
                nc.dueDate && new Date(nc.dueDate) < new Date() && nc.status !== 'CLOSED';
              return overdue ? 'bg-red-50/40' : '';
            }}
            emptyMessage="No non-conformances match your filters"
          />
        )}
      </Card>
    </div>
  );
}
