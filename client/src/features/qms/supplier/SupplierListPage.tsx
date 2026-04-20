import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  Star,
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
import { useSuppliers, mockSuppliers } from './hooks';
import { useFiscalYearStore } from '@/stores/fiscalYearStore';
import type { Supplier, SupplierCategory, SupplierStatus } from './hooks';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function getCategoryBadge(category: SupplierCategory) {
  const map: Record<SupplierCategory, { variant: 'danger' | 'warning' | 'default'; label: string }> = {
    CRITICAL: { variant: 'danger', label: 'Critical' },
    MAJOR: { variant: 'warning', label: 'Major' },
    MINOR: { variant: 'default', label: 'Minor' },
  };
  const c = map[category];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function getStatusBadge(status: SupplierStatus) {
  const map: Record<SupplierStatus, { variant: 'success' | 'warning' | 'info' | 'danger'; label: string }> = {
    APPROVED: { variant: 'success', label: 'Approved' },
    CONDITIONAL: { variant: 'warning', label: 'Conditional' },
    PENDING: { variant: 'info', label: 'Pending' },
    DISQUALIFIED: { variant: 'danger', label: 'Disqualified' },
  };
  const c = map[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function RatingStars({ rating }: { rating: number }) {
  if (rating === 0) return <span className="text-xs text-slate-400 italic">Not rated</span>;
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < full
              ? 'fill-amber-400 text-amber-400'
              : i === full && half
                ? 'fill-amber-400/50 text-amber-400'
                : 'text-gray-200',
          )}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-600">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function SupplierListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      search: search || undefined,
    }),
    [statusFilter, categoryFilter, search],
  );

  const { year } = useFiscalYearStore();
  const { data: result, isLoading } = useSuppliers(filters);
  const suppliers = (result?.data ?? [] as Supplier[]).filter((s: Supplier) => new Date((s as any).createdAt).getFullYear() === year);

  const yearSuppliers = useMemo(() => mockSuppliers.filter((s) => new Date(s.createdAt).getFullYear() === year), [year]);

  // Summary stats
  const totalSuppliers = yearSuppliers.length;
  const approvedCount = yearSuppliers.filter((s) => s.status === 'APPROVED').length;
  const conditionalCount = yearSuppliers.filter((s) => s.status === 'CONDITIONAL').length;
  const disqualifiedCount = yearSuppliers.filter((s) => s.status === 'DISQUALIFIED').length;

  const columns: Column<Supplier>[] = [
    {
      key: 'code',
      header: 'Supplier Code',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">{row.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <span className="font-medium text-slate-900">{row.name}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => getCategoryBadge(row.category),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'productsServices',
      header: 'Products / Services',
      render: (row) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {row.productsServices.slice(0, 2).map((p, i) => (
            <Badge key={i} variant="outline">{p}</Badge>
          ))}
          {row.productsServices.length > 2 && (
            <Badge variant="default">+{row.productsServices.length - 2}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (row) => <RatingStars rating={row.rating} />,
    },
    {
      key: 'certExpiry',
      header: 'Cert Expiry',
      render: (row) => {
        const isExpired = row.certExpiry && new Date(row.certExpiry) < new Date();
        const isExpiringSoon = row.certExpiry && !isExpired &&
          new Date(row.certExpiry) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        return (
          <span
            className={cn(
              'text-sm',
              isExpired && 'font-semibold text-red-600',
              isExpiringSoon && 'font-semibold text-amber-600',
            )}
          >
            {formatDate(row.certExpiry)}
          </span>
        );
      },
    },
    {
      key: 'lastAuditDate',
      header: 'Last Audit',
      render: (row) => (
        <span className="text-sm text-slate-500">
          {row.lastAuditDate ? formatDate(row.lastAuditDate) : '---'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supplier Quality Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage supplier qualifications, performance, and audits
          </p>
        </div>
        <Button onClick={() => navigate('/qms/suppliers/new')}>
          <Plus className="h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Suppliers"
          value={totalSuppliers}
          icon={Building2}
          iconColor="bg-sky-50 text-sky-600"
        />
        <StatsCard
          title="Approved"
          value={approvedCount}
          icon={CheckCircle2}
          iconColor="bg-emerald-50 text-emerald-600"
        />
        <StatsCard
          title="Conditional"
          value={conditionalCount}
          icon={AlertTriangle}
          iconColor="bg-amber-50 text-amber-600"
        />
        <StatsCard
          title="Disqualified"
          value={disqualifiedCount}
          icon={XOctagon}
          iconColor="bg-red-50 text-red-600"
        />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Approved', value: yearSuppliers.filter((s) => s.status === 'APPROVED').length },
                  { name: 'Conditional', value: yearSuppliers.filter((s) => s.status === 'CONDITIONAL').length },
                  { name: 'Pending', value: yearSuppliers.filter((s) => s.status === 'PENDING').length },
                  { name: 'Disqualified', value: yearSuppliers.filter((s) => s.status === 'DISQUALIFIED').length },
                ]}
                cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value"
              >
                {['#22C55E','#F59E0B','#3B82F6','#EF4444'].map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {[{ l: 'Approved', c: '#22C55E' }, { l: 'Conditional', c: '#F59E0B' }, { l: 'Pending', c: '#3B82F6' }, { l: 'Disqualified', c: '#EF4444' }].map(({ l, c }) => (
              <div key={l} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-[10px] text-slate-500">{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">By Category</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { cat: 'Critical', count: yearSuppliers.filter((s) => s.category === 'CRITICAL').length },
              { cat: 'Major', count: yearSuppliers.filter((s) => s.category === 'MAJOR').length },
              { cat: 'Minor', count: yearSuppliers.filter((s) => s.category === 'MINOR').length },
            ]}>
              <XAxis dataKey="cat" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} width={22} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                <Cell fill="#EF4444" /><Cell fill="#F59E0B" /><Cell fill="#94A3B8" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Rating Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { range: '4–5 ★', count: yearSuppliers.filter((s) => s.rating >= 4).length },
              { range: '3–4 ★', count: yearSuppliers.filter((s) => s.rating >= 3 && s.rating < 4).length },
              { range: '2–3 ★', count: yearSuppliers.filter((s) => s.rating >= 2 && s.rating < 3).length },
              { range: '<2 ★', count: yearSuppliers.filter((s) => s.rating > 0 && s.rating < 2).length },
              { range: 'Unrated', count: yearSuppliers.filter((s) => s.rating === 0).length },
            ]}>
              <XAxis dataKey="range" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} width={22} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="#F59E0B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters + Table */}
      <Card noPadding>
        <div className="p-5 border-b border-surface-border">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search suppliers..."
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
              <option value="APPROVED">Approved</option>
              <option value="CONDITIONAL">Conditional</option>
              <option value="PENDING">Pending</option>
              <option value="DISQUALIFIED">Disqualified</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
            >
              <option value="">All Categories</option>
              <option value="CRITICAL">Critical</option>
              <option value="MAJOR">Major</option>
              <option value="MINOR">Minor</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={suppliers}
            onRowClick={(row) => navigate(`/qms/suppliers/${row.id}`)}
            emptyMessage="No suppliers match your filters"
          />
        )}
      </Card>
    </div>
  );
}
