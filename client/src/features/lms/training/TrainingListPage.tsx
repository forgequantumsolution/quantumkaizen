import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  BookOpen,
  Users,
  TrendingUp,
  AlertTriangle,
  List,
  CalendarDays,
} from 'lucide-react';
import { Card, Button, DataTable, Badge, StatusBadge, StatsCard } from '@/components/ui';
import type { Column } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { useTrainingPrograms, useTrainingStats } from './hooks';
import type { TrainingProgram, ProgramType } from './hooks';

const PROGRAM_TYPES: { label: string; value: ProgramType | '' }[] = [
  { label: 'All Types', value: '' },
  { label: 'Induction', value: 'INDUCTION' },
  { label: 'OJT', value: 'OJT' },
  { label: 'Classroom', value: 'CLASSROOM' },
  { label: 'eLearning', value: 'E_LEARNING' },
  { label: 'Regulatory', value: 'REGULATORY' },
  { label: 'Refresher', value: 'REFRESHER' },
];

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Archived', value: 'ARCHIVED' },
  { label: 'Expired', value: 'EXPIRED' },
];

const DEPARTMENTS = ['', 'Quality Assurance', 'Quality Control', 'Production', 'Engineering', 'HSE'];

const DURATION_OPTIONS = [
  { label: 'Any Duration', value: '' },
  { label: '≤ 4 hours', value: 'lte4' },
  { label: '5 – 8 hours', value: '5to8' },
  { label: '9 – 16 hours', value: '9to16' },
  { label: '> 16 hours', value: 'gt16' },
];

/** Parse a duration string like "16 hours" or "4 hours" to a number */
function parseDurationHours(duration: string): number {
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function matchesDuration(duration: string, filter: string): boolean {
  if (!filter) return true;
  const h = parseDurationHours(duration);
  if (filter === 'lte4') return h <= 4;
  if (filter === '5to8') return h >= 5 && h <= 8;
  if (filter === '9to16') return h >= 9 && h <= 16;
  if (filter === 'gt16') return h > 16;
  return true;
}

const typeVariantMap: Record<string, 'info' | 'success' | 'warning' | 'purple' | 'danger' | 'default'> = {
  INDUCTION: 'info',
  OJT: 'warning',
  CLASSROOM: 'purple',
  E_LEARNING: 'success',
  REGULATORY: 'danger',
  REFRESHER: 'default',
};

export default function TrainingListPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const filters = useMemo(
    () => ({
      type: typeFilter || undefined,
      status: statusFilter || undefined,
      department: deptFilter || undefined,
      search: search || undefined,
    }),
    [typeFilter, statusFilter, deptFilter, search],
  );

  const { data: rawPrograms, isLoading } = useTrainingPrograms(filters);

  // Client-side duration filter (duration is a free-text string like "16 hours")
  const programs = useMemo(
    () => rawPrograms.filter((p) => matchesDuration(p.duration, durationFilter)),
    [rawPrograms, durationFilter],
  );
  const stats = useTrainingStats();

  const columns: Column<TrainingProgram>[] = [
    {
      key: 'programId',
      header: 'Program ID',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">{row.programId}</span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <span className="max-w-xs truncate font-medium text-slate-900">{row.title}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge variant={typeVariantMap[row.type] || 'default'}>
          {row.type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => <span className="text-slate-600">{row.duration}</span>,
    },
    {
      key: 'enrolled',
      header: 'Enrolled',
      render: (row) => <span className="font-medium text-slate-900">{row.enrolled}</span>,
    },
    {
      key: 'completionRate',
      header: 'Completion %',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${row.completionRate}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-700">{row.completionRate}%</span>
        </div>
      ),
    },
    {
      key: 'validityPeriod',
      header: 'Validity',
      render: (row) => <span className="text-slate-500">{row.validityPeriod}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Training Programs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage training programs, competency development, and certification tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded transition-colors text-xs flex items-center gap-1', viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-gray-400')}>
              <List size={13} /> List
            </button>
            <button onClick={() => setViewMode('calendar')} className={cn('p-1.5 rounded transition-colors text-xs flex items-center gap-1', viewMode === 'calendar' ? 'bg-slate-900 text-white' : 'text-gray-400')}>
              <CalendarDays size={13} /> Calendar
            </button>
          </div>
          <Button onClick={() => navigate('/lms/training/new')}>
            <Plus className="h-4 w-4" />
            Create Program
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Programs"
          value={stats.activePrograms}
          icon={BookOpen}
          trend={{ value: 12, label: 'vs last quarter' }}
        />
        <StatsCard
          title="Enrolled Trainees"
          value={stats.totalEnrolled}
          icon={Users}
          trend={{ value: 8, label: 'vs last month' }}
          iconColor="bg-sky-50 text-sky-600"
        />
        <StatsCard
          title="Completion Rate"
          value={`${stats.avgCompletion}%`}
          icon={TrendingUp}
          trend={{ value: 5, label: 'vs last quarter' }}
          iconColor="bg-emerald-50 text-emerald-600"
        />
        <StatsCard
          title="Expiring Certifications"
          value={stats.expiringCerts}
          icon={AlertTriangle}
          trend={{ value: -3, label: 'vs last month' }}
          iconColor="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search programs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded border border-gray-300 bg-white py-0 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          {[
            { value: typeFilter,     onChange: setTypeFilter,     options: PROGRAM_TYPES.map(t => ({ label: t.label, value: t.value })) },
            { value: statusFilter,   onChange: setStatusFilter,   options: STATUS_OPTIONS.map(s => ({ label: s.label, value: s.value })) },
            { value: deptFilter,     onChange: setDeptFilter,     options: [{ label: 'All Departments', value: '' }, ...DEPARTMENTS.filter(Boolean).map(d => ({ label: d, value: d }))] },
            { value: durationFilter, onChange: setDurationFilter, options: DURATION_OPTIONS.map(d => ({ label: d.label, value: d.value })) },
          ].map((sel, i) => (
            <select
              key={i}
              value={sel.value}
              onChange={(e) => sel.onChange(e.target.value)}
              className="h-9 rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              {sel.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ))}
        </div>
      </Card>

      {/* Table or Calendar */}
      {viewMode === 'list' && (
        <Card noPadding>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={programs}
              onRowClick={(row) => navigate(`/lms/training/${row.id}`)}
              emptyMessage="No training programs match your filters"
            />
          )}
        </Card>
      )}

      {viewMode === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Training Due This Month</h3>
            {/* Group mock participants by due date week */}
            <div className="space-y-3">
              {['Week 1 (Apr 1-7)', 'Week 2 (Apr 8-14)', 'Week 3 (Apr 15-21)', 'Week 4 (Apr 22-30)'].map((week, wi) => {
                const participants = [
                  { name: 'John Smith', program: 'IATF 16949 Awareness', status: 'NOT_STARTED' },
                  { name: 'Lisa Park', program: 'ISO 9001:2015 Fundamentals', status: 'IN_PROGRESS' },
                  { name: 'Mike Chen', program: 'Safety Induction', status: 'NOT_STARTED' },
                  { name: 'Emma Wilson', program: 'CAPA Training', status: 'COMPLETED' },
                ].filter((_, i) => i % 4 === wi);
                return (
                  <div key={week}>
                    <p className="text-xs font-semibold text-gray-500 mb-2">{week}</p>
                    <div className="space-y-1">
                      {participants.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                          <div className="w-7 h-7 rounded-full bg-slate-900/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-slate-900">{p.name.split(' ').map((n) => n[0]).join('')}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.program}</p>
                          </div>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                            p.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            p.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500')}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                      {participants.length === 0 && <p className="text-xs text-gray-400 italic py-1">No training due</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compliance by department */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Training Compliance by Department</h3>
            <div className="space-y-3">
              {[
                { dept: 'Quality', total: 12, complete: 11, pct: 92 },
                { dept: 'Production', total: 28, complete: 22, pct: 79 },
                { dept: 'R&D', total: 8, complete: 8, pct: 100 },
                { dept: 'Procurement', total: 6, complete: 4, pct: 67 },
                { dept: 'Operations', total: 15, complete: 13, pct: 87 },
              ].map(({ dept, total, complete, pct }) => (
                <div key={dept} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-700 shrink-0">{dept}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-400')} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-20 text-right">{complete}/{total} ({pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
