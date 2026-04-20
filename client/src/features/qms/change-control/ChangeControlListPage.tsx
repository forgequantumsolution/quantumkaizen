import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  GitPullRequest,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  Card,
  Button,
  DataTable,
  StatsCard,
  Badge,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { useChangeRequests, mockChangeRequests } from './hooks';
import { useFiscalYearStore } from '@/stores/fiscalYearStore';
import type { ChangeRequest } from './hooks';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const STATUSES = ['', 'Draft', 'Under Review', 'Approved', 'In Implementation', 'Validated', 'Closed', 'Rejected'];
const CHANGE_TYPES = ['', 'Process', 'Product', 'System', 'Document'];
const IMPACT_LEVELS = ['', 'High', 'Medium', 'Low'];

const typeColors: Record<string, string> = {
  Process: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Product: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  System: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Document: 'bg-slate-100 text-slate-700 ring-slate-600/20',
};

const impactColors: Record<string, string> = {
  High: 'bg-red-50 text-red-700 ring-red-600/20',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Low: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

const statusColors: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700 ring-slate-600/20',
  'Under Review': 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'In Implementation': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  Validated: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  Closed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  Rejected: 'bg-red-50 text-red-700 ring-red-600/20',
};

export default function ChangeControlListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [impactFilter, setImpactFilter] = useState('');
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      changeType: typeFilter || undefined,
      impactLevel: impactFilter || undefined,
      search: search || undefined,
    }),
    [statusFilter, typeFilter, impactFilter, search],
  );

  const { year } = useFiscalYearStore();
  const { data: result, isLoading } = useChangeRequests(filters);
  const changeRequests = (result?.data ?? [] as ChangeRequest[]).filter((cr: ChangeRequest) => new Date((cr as any).createdAt).getFullYear() === year);

  const yearCRs = useMemo(() => mockChangeRequests.filter((cr) => new Date(cr.createdAt).getFullYear() === year), [year]);

  // Summary counts
  const openCount = yearCRs.filter((cr) =>
    ['Draft', 'Under Review'].includes(cr.status),
  ).length;
  const pendingApproval = yearCRs.filter(
    (cr) => cr.status === 'Under Review',
  ).length;
  const implementedCount = yearCRs.filter((cr) =>
    ['Validated', 'Closed'].includes(cr.status),
  ).length;
  const rejectedCount = yearCRs.filter(
    (cr) => cr.status === 'Rejected',
  ).length;

  const columns: Column<ChangeRequest>[] = [
    {
      key: 'crNumber',
      header: 'CR Number',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">
          {row.crNumber}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <span className="block max-w-xs truncate font-medium text-slate-900">
          {row.title}
        </span>
      ),
    },
    {
      key: 'changeType',
      header: 'Type',
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
            typeColors[row.changeType],
          )}
        >
          {row.changeType}
        </span>
      ),
    },
    {
      key: 'impactLevel',
      header: 'Impact Level',
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
            impactColors[row.impactLevel],
          )}
        >
          {row.impactLevel}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
            statusColors[row.status],
          )}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'requestor',
      header: 'Requestor',
      render: (row) => <span className="text-slate-600">{row.requestor}</span>,
    },
    {
      key: 'targetDate',
      header: 'Target Date',
      render: (row) => {
        const overdue =
          new Date(row.targetDate) < new Date() &&
          !['Closed', 'Validated', 'Rejected'].includes(row.status);
        return (
          <span className={cn('text-sm', overdue && 'font-semibold text-red-600')}>
            {formatDate(row.targetDate)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Change Control</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage and track change requests across processes, products, and systems
          </p>
        </div>
        <Button onClick={() => navigate('/qms/change-control/new')}>
          <Plus className="h-4 w-4" />
          New Change Request
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Open Requests"
          value={openCount}
          icon={GitPullRequest}
          iconColor="bg-blue-50 text-blue-600"
          onClick={() => setStatusFilter('Under Review')}
        />
        <StatsCard
          title="Pending Approval"
          value={pendingApproval}
          icon={Clock}
          iconColor="bg-amber-50 text-amber-600"
          onClick={() => setStatusFilter('Draft')}
        />
        <StatsCard
          title="Implemented"
          value={implementedCount}
          icon={CheckCircle2}
          iconColor="bg-emerald-50 text-emerald-600"
          onClick={() => setStatusFilter('In Implementation')}
        />
        <StatsCard
          title="Rejected"
          value={rejectedCount}
          icon={XCircle}
          iconColor="bg-red-50 text-red-600"
          onClick={() => setStatusFilter('Rejected')}
        />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">By Type</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Process', value: yearCRs.filter((c) => c.changeType === 'Process').length },
                  { name: 'Product', value: yearCRs.filter((c) => c.changeType === 'Product').length },
                  { name: 'System', value: yearCRs.filter((c) => c.changeType === 'System').length },
                  { name: 'Document', value: yearCRs.filter((c) => c.changeType === 'Document').length },
                ]}
                cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value"
              >
                {['#3B82F6','#A855F7','#F59E0B','#94A3B8'].map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {[{ l: 'Process', c: '#3B82F6' }, { l: 'Product', c: '#A855F7' }, { l: 'System', c: '#F59E0B' }, { l: 'Document', c: '#94A3B8' }].map(({ l, c }) => (
              <div key={l} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-[10px] text-slate-500">{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">By Impact Level</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { impact: 'High', count: yearCRs.filter((c) => c.impactLevel === 'High').length },
              { impact: 'Medium', count: yearCRs.filter((c) => c.impactLevel === 'Medium').length },
              { impact: 'Low', count: yearCRs.filter((c) => c.impactLevel === 'Low').length },
            ]}>
              <XAxis dataKey="impact" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} width={22} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                <Cell fill="#EF4444" /><Cell fill="#F59E0B" /><Cell fill="#22C55E" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Status Flow</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { status: 'Draft', count: yearCRs.filter((c) => c.status === 'Draft').length },
              { status: 'Review', count: yearCRs.filter((c) => c.status === 'Under Review').length },
              { status: 'Approved', count: yearCRs.filter((c) => c.status === 'Approved').length },
              { status: 'Impl.', count: yearCRs.filter((c) => c.status === 'In Implementation').length },
              { status: 'Validated', count: yearCRs.filter((c) => c.status === 'Validated').length },
              { status: 'Closed', count: yearCRs.filter((c) => c.status === 'Closed').length },
              { status: 'Rejected', count: yearCRs.filter((c) => c.status === 'Rejected').length },
            ]} layout="vertical" margin={{ left: 4 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 10 }} width={56} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="#0D0E17" radius={[0, 3, 3, 0]} />
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
              placeholder="Search change requests..."
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
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Types</option>
            {CHANGE_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={impactFilter}
            onChange={(e) => setImpactFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Impact Levels</option>
            {IMPACT_LEVELS.filter(Boolean).map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={changeRequests}
            onRowClick={(row) =>
              navigate(`/qms/change-control/${(row as ChangeRequest).id}`)
            }
            emptyMessage="No change requests match your filters"
          />
        )}
      </Card>
    </div>
  );
}
