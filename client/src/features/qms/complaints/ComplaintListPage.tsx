import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  MessageSquareWarning,
  AlertTriangle,
  Clock,
  ThumbsUp,
} from 'lucide-react';
import {
  Card,
  Button,
  DataTable,
  StatsCard,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { useComplaints, mockComplaints } from './hooks';
import { useFiscalYearStore } from '@/stores/fiscalYearStore';
import type { Complaint } from './hooks';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const STATUSES = ['', 'Received', 'Acknowledged', 'Under Investigation', 'Resolution Proposed', 'Closed'];
const SEVERITIES = ['', 'Critical', 'Major', 'Minor'];

const severityColors: Record<string, string> = {
  Critical: 'bg-red-50 text-red-700 ring-red-600/20',
  Major: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Minor: 'bg-slate-100 text-slate-700 ring-slate-600/20',
};

const statusColors: Record<string, string> = {
  Received: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Acknowledged: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'Under Investigation': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Resolution Proposed': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  Closed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

export default function ComplaintListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      search: search || undefined,
    }),
    [statusFilter, severityFilter, search],
  );

  const { year } = useFiscalYearStore();
  const { data: result, isLoading } = useComplaints(filters);
  const complaints = (result?.data ?? [] as Complaint[]).filter((c: Complaint) => new Date(c.receivedDate).getFullYear() === year);

  const yearComplaints = useMemo(() => mockComplaints.filter((c) => new Date(c.receivedDate).getFullYear() === year), [year]);

  // Summary counts
  const openCount = yearComplaints.filter(
    (c) => c.status !== 'Closed',
  ).length;
  const overdueCount = yearComplaints.filter(
    (c) =>
      c.responseDue &&
      new Date(c.responseDue) < new Date() &&
      c.status !== 'Closed',
  ).length;
  // Average resolution time for closed complaints
  const closedComplaints = yearComplaints.filter((c) => c.status === 'Closed');
  const avgResolutionDays =
    closedComplaints.length > 0
      ? Math.round(
          closedComplaints.reduce((sum, c) => {
            const received = new Date(c.receivedDate).getTime();
            const closed = new Date(c.updatedAt).getTime();
            return sum + (closed - received) / (1000 * 60 * 60 * 24);
          }, 0) / closedComplaints.length,
        )
      : 0;
  const satisfactionPercent = 87;

  const columns: Column<Complaint>[] = [
    {
      key: 'complaintNumber',
      header: 'Complaint No.',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">
          {row.complaintNumber}
        </span>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (row) => (
        <span className="block max-w-[160px] truncate font-medium text-slate-900">
          {row.customerName}
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <span className="block max-w-[200px] truncate text-slate-700">{row.subject}</span>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
            severityColors[row.severity],
          )}
        >
          {row.severity}
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
      key: 'productService',
      header: 'Product / Service',
      render: (row) => (
        <span className="block max-w-[140px] truncate text-sm text-slate-600">
          {row.productService}
        </span>
      ),
    },
    {
      key: 'receivedDate',
      header: 'Received',
      render: (row) => (
        <span className="text-sm text-slate-500">{formatDate(row.receivedDate)}</span>
      ),
    },
    {
      key: 'responseDue',
      header: 'Response Due',
      render: (row) => {
        const overdue =
          row.responseDue &&
          new Date(row.responseDue) < new Date() &&
          row.status !== 'Closed';
        return (
          <span className={cn('text-sm', overdue && 'font-semibold text-red-600')}>
            {formatDate(row.responseDue)}
          </span>
        );
      },
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (row) => <span className="text-slate-600">{row.assignedTo}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Complaints</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track, investigate, and resolve customer complaints
          </p>
        </div>
        <Button onClick={() => navigate('/qms/complaints/new')}>
          <Plus className="h-4 w-4" />
          Log Complaint
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Open Complaints"
          value={openCount}
          icon={MessageSquareWarning}
          iconColor="bg-amber-50 text-amber-600"
          onClick={() => setStatusFilter('Received')}
        />
        <StatsCard
          title="Response Overdue"
          value={overdueCount}
          icon={AlertTriangle}
          iconColor="bg-red-50 text-red-600"
          onClick={() => setStatusFilter('Under Investigation')}
        />
        <StatsCard
          title="Avg Resolution Time"
          value={`${avgResolutionDays} days`}
          icon={Clock}
          iconColor="bg-sky-50 text-sky-600"
        />
        <StatsCard
          title="Customer Satisfaction"
          value={`${satisfactionPercent}%`}
          icon={ThumbsUp}
          iconColor="bg-emerald-50 text-emerald-600"
          onClick={() => setStatusFilter('Closed')}
        />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">By Severity</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Critical', value: yearComplaints.filter((c) => c.severity === 'Critical').length },
                  { name: 'Major', value: yearComplaints.filter((c) => c.severity === 'Major').length },
                  { name: 'Minor', value: yearComplaints.filter((c) => c.severity === 'Minor').length },
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
              { month: 'Nov', received: 4, closed: 2 },
              { month: 'Dec', received: 6, closed: 4 },
              { month: 'Jan', received: 5, closed: 4 },
              { month: 'Feb', received: 8, closed: 5 },
              { month: 'Mar', received: 7, closed: 6 },
              { month: 'Apr', received: openCount, closed: closedComplaints.length },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={22} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="received" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={2} name="Received" />
              <Area type="monotone" dataKey="closed" stroke="#22C55E" fill="#DCFCE7" strokeWidth={2} name="Closed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { status: 'Received', count: yearComplaints.filter((c) => c.status === 'Received').length },
              { status: 'Acknowledged', count: yearComplaints.filter((c) => c.status === 'Acknowledged').length },
              { status: 'Investigating', count: yearComplaints.filter((c) => c.status === 'Under Investigation').length },
              { status: 'Proposed', count: yearComplaints.filter((c) => c.status === 'Resolution Proposed').length },
              { status: 'Closed', count: yearComplaints.filter((c) => c.status === 'Closed').length },
            ]}>
              <XAxis dataKey="status" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} width={22} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="#0D0E17" radius={[3, 3, 0, 0]} />
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
              placeholder="Search complaints..."
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
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Severities</option>
            {SEVERITIES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
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
            data={complaints}
            onRowClick={(row) =>
              navigate(`/qms/complaints/${(row as Complaint).id}`)
            }
            rowClassName={(row) => {
              const c = row as Complaint;
              const overdue =
                c.responseDue &&
                new Date(c.responseDue) < new Date() &&
                c.status !== 'Closed';
              return overdue ? 'bg-red-50/40' : '';
            }}
            emptyMessage="No complaints match your filters"
          />
        )}
      </Card>
    </div>
  );
}
