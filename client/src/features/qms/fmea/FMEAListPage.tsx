import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileWarning, AlertTriangle, BarChart3, Users } from 'lucide-react';
import {
  Card,
  Button,
  DataTable,
  StatsCard,
  StatusBadge,
  Badge,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import Tabs from '@/components/ui/Tabs';
import { cn, formatDate } from '@/lib/utils';
import { useFMEAs, mockFMEAs } from './hooks';
import { useFiscalYearStore } from '@/stores/fiscalYearStore';
import type { FMEA } from './hooks';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function FMEAListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const filters = useMemo(
    () => ({
      type: activeTab === 'all' ? undefined : activeTab,
      search: search || undefined,
    }),
    [activeTab, search],
  );

  const { year } = useFiscalYearStore();
  const { data: result, isLoading } = useFMEAs(filters);
  const fmeas = (result?.data ?? [] as FMEA[]).filter((f: FMEA) => new Date((f as any).createdAt).getFullYear() === year);

  const yearFMEAs = useMemo(() => mockFMEAs.filter((f) => new Date(f.createdAt).getFullYear() === year), [year]);

  const fmeaTabs = useMemo(() => [
    { id: 'all', label: 'All', count: yearFMEAs.length },
    { id: 'DFMEA', label: 'DFMEA (Design)', count: yearFMEAs.filter((f) => f.type === 'DFMEA').length },
    { id: 'PFMEA', label: 'PFMEA (Process)', count: yearFMEAs.filter((f) => f.type === 'PFMEA').length },
  ], [yearFMEAs]);

  // Summary stats
  const totalFMEAs = yearFMEAs.length;
  const activeFMEAs = yearFMEAs.filter((f) => f.status === 'IN_PROGRESS').length;
  const highRPNCount = yearFMEAs.filter((f) => f.maxRPN > 100).length;
  const teamMembersCount = new Set(yearFMEAs.flatMap((f) => [f.owner, ...f.teamMembers])).size;

  const columns: Column<FMEA>[] = [
    {
      key: 'fmeaNumber',
      header: 'FMEA Number',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">{row.fmeaNumber}</span>
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
      render: (row) => (
        <Badge variant={row.type === 'DFMEA' ? 'info' : 'purple'}>
          {row.type}
        </Badge>
      ),
    },
    {
      key: 'productProcess',
      header: 'Product / Process',
      render: (row) => (
        <span className="text-sm text-slate-600">{row.productProcess}</span>
      ),
    },
    {
      key: 'maxRPN',
      header: 'Max RPN',
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold',
            row.maxRPN > 200
              ? 'bg-red-100 text-red-700'
              : row.maxRPN > 100
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700',
          )}
        >
          {row.maxRPN}
        </span>
      ),
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
      key: 'updatedAt',
      header: 'Last Updated',
      render: (row) => <span className="text-sm text-slate-500">{formatDate(row.updatedAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">FMEA Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Failure Mode and Effects Analysis - AIAG-VDA methodology
          </p>
        </div>
        <Button onClick={() => navigate('/qms/fmea/new')}>
          <Plus className="h-4 w-4" />
          Create FMEA
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total FMEAs"
          value={totalFMEAs}
          icon={FileWarning}
          iconColor="bg-sky-50 text-sky-600"
        />
        <StatsCard
          title="Active / In Progress"
          value={activeFMEAs}
          icon={BarChart3}
          iconColor="bg-amber-50 text-amber-600"
        />
        <StatsCard
          title="High RPN (>100)"
          value={highRPNCount}
          icon={AlertTriangle}
          iconColor="bg-red-50 text-red-600"
        />
        <StatsCard
          title="Team Members"
          value={teamMembersCount}
          icon={Users}
          iconColor="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">RPN Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { range: '0–50', count: yearFMEAs.filter((f) => f.maxRPN <= 50).length },
              { range: '51–100', count: yearFMEAs.filter((f) => f.maxRPN > 50 && f.maxRPN <= 100).length },
              { range: '101–200', count: yearFMEAs.filter((f) => f.maxRPN > 100 && f.maxRPN <= 200).length },
              { range: '200+', count: yearFMEAs.filter((f) => f.maxRPN > 200).length },
            ]}>
              <XAxis dataKey="range" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={22} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                <Cell fill="#22C55E" />
                <Cell fill="#F59E0B" />
                <Cell fill="#F97316" />
                <Cell fill="#EF4444" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">DFMEA vs PFMEA</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={[
                  { name: 'DFMEA', value: yearFMEAs.filter((f) => f.type === 'DFMEA').length },
                  { name: 'PFMEA', value: yearFMEAs.filter((f) => f.type === 'PFMEA').length },
                ]}
                cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={4} dataKey="value"
              >
                <Cell fill="#3B82F6" /><Cell fill="#A855F7" />
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-1">
            {[{ label: 'DFMEA (Design)', color: '#3B82F6' }, { label: 'PFMEA (Process)', color: '#A855F7' }].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">By Status</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { status: 'Draft', count: yearFMEAs.filter((f) => f.status === 'DRAFT').length },
              { status: 'In Progress', count: yearFMEAs.filter((f) => f.status === 'IN_PROGRESS').length },
              { status: 'Review', count: yearFMEAs.filter((f) => f.status === 'UNDER_REVIEW').length },
              { status: 'Approved', count: yearFMEAs.filter((f) => f.status === 'APPROVED').length },
              { status: 'Closed', count: yearFMEAs.filter((f) => f.status === 'CLOSED').length },
            ]} layout="vertical" margin={{ left: 4 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 10 }} width={60} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="#0D0E17" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs + Search */}
      <Card noPadding>
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-4">
            <Tabs tabs={fmeaTabs} activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="relative ml-4 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search FMEAs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={fmeas}
            onRowClick={(row) => navigate(`/qms/fmea/${row.id}`)}
            emptyMessage="No FMEAs match your filters"
          />
        )}
      </Card>
    </div>
  );
}
