import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardCheck, LayoutList, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { StatsCard } from '@/components/ui/StatsCard';
import { useAudits, useAuditStats, type Audit, type AuditStatus, type AuditType } from './hooks';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<AuditStatus, string> = {
  PLANNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const TYPE_LABELS: Record<AuditType, string> = {
  INTERNAL: 'Internal',
  EXTERNAL: 'External',
  SUPPLIER: 'Supplier',
  CERTIFICATION: 'Certification',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AuditListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  const { data: audits = [], isLoading } = useAudits({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });
  const { data: stats } = useAuditStats();

  // ── Calendar helpers ────────────────────────────────────────────────────

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // ── Table columns ───────────────────────────────────────────────────────

  const columns: Column<Audit>[] = [
    {
      key: 'auditNumber',
      header: 'Audit #',
      render: (row) => (
        <span className="font-mono text-mono-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
          {row.auditNumber}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => <span className="text-sm font-medium text-gray-900">{row.title}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900/10 text-slate-900 font-medium">
          {TYPE_LABELS[row.type]}
        </span>
      ),
    },
    {
      key: 'standard',
      header: 'Standard',
      render: (row) => <span className="text-xs text-gray-600">{row.standard}</span>,
    },
    {
      key: 'leadAuditor',
      header: 'Lead Auditor',
      render: (row) => <span className="text-sm text-gray-700">{row.leadAuditor}</span>,
    },
    {
      key: 'plannedStart',
      header: 'Planned Date',
      render: (row) => (
        <span className="text-xs text-gray-500">{new Date(row.plannedStart).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'majorFindings',
      header: 'Findings',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.majorFindings > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
              {row.majorFindings} Maj
            </span>
          )}
          {row.minorFindings > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              {row.minorFindings} Min
            </span>
          )}
          {row.majorFindings === 0 && row.minorFindings === 0 && (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[row.status]}`}>
          {row.status.replace('_', ' ')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-gray-900">Audit Management</h1>
          <p className="text-body text-gray-500 mt-0.5">Schedule, execute, and track internal & external audits</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/qms/audits/new')}>
          <Plus size={16} />
          Schedule Audit
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Total Audits" value={stats?.total ?? 0} icon={ClipboardCheck} />
        <StatsCard title="Planned" value={stats?.planned ?? 0} icon={ClipboardCheck} />
        <StatsCard title="In Progress" value={stats?.inProgress ?? 0} icon={ClipboardCheck} />
        <StatsCard title="Open Findings" value={stats?.openFindings ?? 0} icon={ClipboardCheck} />
      </div>

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-base w-40"
        >
          <option value="">All Statuses</option>
          <option value="PLANNED">Planned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input-base w-40"
        >
          <option value="">All Types</option>
          <option value="INTERNAL">Internal</option>
          <option value="EXTERNAL">External</option>
          <option value="SUPPLIER">Supplier</option>
          <option value="CERTIFICATION">Certification</option>
        </select>

        {/* View toggle */}
        <div className="flex items-center gap-1 ml-auto border border-gray-200 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <LayoutList size={14} />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'calendar' ? 'bg-slate-900 text-white' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <CalendarDays size={14} />
          </button>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <DataTable
          data={audits}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No audits found"
          onRowClick={(row) => navigate(`/qms/audits/${row.id}`)}
        />
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {MONTH_NAMES[month]} {year}
            </h3>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayAudits = (audits as any[]).filter((a: any) =>
                a.plannedStart?.startsWith(dateStr),
              );
              const isToday = day === today.getDate();
              return (
                <div
                  key={day}
                  className={cn(
                    'min-h-[56px] rounded-lg p-1 border text-xs',
                    isToday ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-gray-200',
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isToday ? 'text-blue-600' : 'text-gray-500',
                    )}
                  >
                    {day}
                  </span>
                  {dayAudits.map((a: any) => (
                    <div
                      key={a.id}
                      onClick={() => navigate(`/qms/audits/${a.id}`)}
                      className="mt-0.5 px-1 py-0.5 bg-slate-900 text-white rounded text-[10px] truncate cursor-pointer hover:bg-slate-900/80 transition-colors"
                    >
                      {a.title.slice(0, 20)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
