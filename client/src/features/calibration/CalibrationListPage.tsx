import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wrench, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatsCard } from '@/components/ui/StatsCard';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { cn } from '@/lib/utils';
import { useCalibrationRecords, useCalibrationStats, type CalibrationRecord, type CalibrationStatus } from './hooks';

const STATUS_CONFIG: Record<CalibrationStatus, { label: string; color: string }> = {
  CURRENT: { label: 'Current', color: 'bg-green-100 text-green-700' },
  DUE_SOON: { label: 'Due Soon', color: 'bg-amber-100 text-amber-700' },
  OVERDUE: { label: 'Overdue', color: 'bg-red-100 text-red-700' },
  OUT_OF_SERVICE: { label: 'Out of Service', color: 'bg-gray-100 text-gray-500' },
};

export default function CalibrationListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: records = [], isLoading } = useCalibrationRecords({
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
  });
  const { data: stats } = useCalibrationStats();

  const columns: Column<CalibrationRecord>[] = [
    {
      key: 'equipmentId',
      header: 'Equipment ID',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900 bg-blue-600-pale px-1.5 py-0.5 rounded">
          {row.equipmentId}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="text-sm font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <span className="text-xs text-gray-600">{row.category}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      render: (row) => <span className="text-xs text-gray-500">{row.location}</span>,
    },
    {
      key: 'lastCalibrated',
      header: 'Last Calibrated',
      render: (row) => (
        <span className="text-xs text-gray-500">
          {new Date(row.lastCalibrated).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'nextDue',
      header: 'Next Due',
      render: (row) => {
        const isOverdue = row.status === 'OVERDUE';
        const isDue = row.status === 'DUE_SOON';
        return (
          <span className={cn('text-xs font-medium', isOverdue ? 'text-red-600' : isDue ? 'text-amber-600' : 'text-gray-500')}>
            {new Date(row.nextDue).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const cfg = STATUS_CONFIG[row.status];
        return (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
            {cfg.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calibration Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track equipment calibration schedules, certificates, and due dates
          </p>
        </div>
        <Button onClick={() => navigate('/calibration/new')}>
          <Plus size={16} />
          Add Equipment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatsCard title="Total Equipment" value={stats?.total ?? 0} icon={Wrench} />
        <StatsCard title="Current" value={stats?.current ?? 0} icon={CheckCircle2} iconColor="bg-green-50 text-green-600" />
        <StatsCard title="Due Soon" value={stats?.dueSoon ?? 0} icon={Clock} iconColor="bg-amber-50 text-amber-600" />
        <StatsCard title="Overdue" value={stats?.overdue ?? 0} icon={AlertTriangle} iconColor="bg-red-50 text-red-600" />
        <StatsCard title="Out of Service" value={stats?.outOfService ?? 0} icon={XCircle} iconColor="bg-gray-100 text-gray-500" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
        >
          <option value="">All Statuses</option>
          <option value="CURRENT">Current</option>
          <option value="DUE_SOON">Due Soon</option>
          <option value="OVERDUE">Overdue</option>
          <option value="OUT_OF_SERVICE">Out of Service</option>
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
        >
          <option value="">All Categories</option>
          <option value="MEASUREMENT">Measurement</option>
          <option value="TEST">Test</option>
          <option value="MONITORING">Monitoring</option>
          <option value="PRODUCTION">Production</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-surface-border shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={records}
          isLoading={isLoading}
          emptyMessage="No equipment records found"
          onRowClick={(row) => navigate(`/calibration/${row.id}`)}
        />
      </div>
    </div>
  );
}
