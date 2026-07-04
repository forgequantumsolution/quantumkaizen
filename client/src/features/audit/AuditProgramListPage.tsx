import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Drawer, Input, Modal } from 'antd';
import { Search, CalendarDays, CalendarClock, SlidersHorizontal, Check, X } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuditPrograms, type AuditProgram, type ProgramStatus } from '@/lib/api/audit';

const PAGE_SIZE = 10;
import { ProgramStatusBadge } from './auditStatusBadge';
import AuditSchedulePage from './AuditSchedulePage';

const TABS: { key: ProgramStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PLANNED', label: 'Planned' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function AuditProgramListPage() {
  const nav = useNavigate();
  const [status, setStatus] = useState<ProgramStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const activeStatusLabel = TABS.find((t) => t.key === status)?.label ?? 'All';

  const debouncedSearch = useDebouncedValue(search, 450);
  useEffect(() => setPage(1), [debouncedSearch, status]);

  const { data, isLoading } = useAuditPrograms({
    page,
    page_size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    search: debouncedSearch || undefined,
  });
  const rows = data?.data ?? [];
  const totalItems = data?.pagination?.total_items ?? rows.length;

  // Per-status counts come from the server (they ignore the status filter).
  const sc = data?.counts ?? {};
  const counts = {
    PLANNED: sc.PLANNED ?? 0,
    IN_PROGRESS: sc.IN_PROGRESS ?? 0,
    COMPLETED: sc.COMPLETED ?? 0,
    CANCELLED: sc.CANCELLED ?? 0,
  };
  const totalCount = Object.values(sc).reduce((a, b) => a + b, 0);

  return (
    <>
      {/* Single toolbar row: title + search + filter. */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Audit Execution</h2>
          <p className="text-xs text-gray-500">
            Approved audits ready to start and track through execution.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            />
            <Input
              placeholder="Search by program/register #…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              style={{ width: 240 }}
            />
          </div>
          <Button
            icon={<CalendarDays size={14} />}
            type={calendarOpen ? 'primary' : 'default'}
            onClick={() => setCalendarOpen((v) => !v)}
          >
            Calendar
          </Button>
          <Button icon={<CalendarClock size={14} />} onClick={() => setRulesOpen(true)}>
            Rules
          </Button>
          <Button icon={<SlidersHorizontal size={14} />} onClick={() => setFilterOpen(true)}>
            Filter
            {status !== 'ALL' && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-gold-100 text-gold-700 text-[10px] font-semibold px-1.5 py-0.5">
                {activeStatusLabel}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Calendar — opens at the top on demand. */}
      {calendarOpen && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gold-50 text-gold-600 flex items-center justify-center ring-1 ring-gold-200">
                <CalendarDays size={15} />
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-900 leading-none">
                  Planned-audit calendar
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Scheduled &amp; recurring audits by date
                </div>
              </div>
            </div>
            <button
              onClick={() => setCalendarOpen(false)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Close calendar"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-3">
            <AuditSchedulePage section="calendar" embedded />
          </div>
        </div>
      )}

      {/* Filter modal — status selection lives here now. */}
      <Modal
        open={filterOpen}
        onCancel={() => setFilterOpen(false)}
        title="Filter programs"
        footer={
          <div className="flex items-center justify-between">
            <Button type="text" onClick={() => setStatus('ALL')} disabled={status === 'ALL'}>
              Clear
            </Button>
            <Button type="primary" onClick={() => setFilterOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="py-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TABS.map((t) => {
              const active = status === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setStatus(t.key)}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-gold-400 bg-gold-50 text-gold-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span>{t.label}</span>
                  {active && <Check size={15} className="text-gold-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Status overview — also acts as quick status filters. */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <StatCard
          label="Total"
          value={totalCount}
          tone="slate"
          active={status === 'ALL'}
          onClick={() => setStatus('ALL')}
        />
        <StatCard
          label="Planned"
          value={counts.PLANNED}
          tone="gray"
          active={status === 'PLANNED'}
          onClick={() => setStatus('PLANNED')}
        />
        <StatCard
          label="In Progress"
          value={counts.IN_PROGRESS}
          tone="blue"
          active={status === 'IN_PROGRESS'}
          onClick={() => setStatus('IN_PROGRESS')}
        />
        <StatCard
          label="Completed"
          value={counts.COMPLETED}
          tone="green"
          active={status === 'COMPLETED'}
          onClick={() => setStatus('COMPLETED')}
        />
        <StatCard
          label="Cancelled"
          value={counts.CANCELLED}
          tone="red"
          active={status === 'CANCELLED'}
          onClick={() => setStatus('CANCELLED')}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <DataTable<AuditProgram>
          data={rows}
          isLoading={isLoading}
          emptyMessage="No audit programs found"
          onRowClick={(r) => nav(`/audit/program/${r.id}`)}
          columns={PROGRAM_COLUMNS}
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems,
            onPageChange: setPage,
          }}
        />
      </div>

      {/* Recurrence rules — opened in a drawer for a focused, out-of-the-way edit. */}
      <Drawer
        title="Audit schedule — recurrence rules"
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        width={880}
      >
        <AuditSchedulePage section="rules" embedded />
      </Drawer>
    </>
  );
}

const STAT_TONES = {
  slate: { ring: 'ring-slate-200', text: 'text-slate-700', dot: '#64748B', activeBg: 'bg-slate-50' },
  gray: { ring: 'ring-gray-200', text: 'text-gray-600', dot: '#9CA3AF', activeBg: 'bg-gray-50' },
  blue: { ring: 'ring-blue-200', text: 'text-blue-700', dot: '#3B82F6', activeBg: 'bg-blue-50' },
  green: { ring: 'ring-emerald-200', text: 'text-emerald-700', dot: '#10B981', activeBg: 'bg-emerald-50' },
  red: { ring: 'ring-red-200', text: 'text-red-600', dot: '#EF4444', activeBg: 'bg-red-50' },
} as const;

function StatCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: keyof typeof STAT_TONES;
  active: boolean;
  onClick: () => void;
}) {
  const t = STAT_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-white px-3 py-2.5 text-left transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
        active ? `border-transparent ring-2 ${t.ring} ${t.activeBg}` : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">
          {label}
        </span>
      </div>
      <div className={`text-xl font-bold tabular-nums mt-0.5 ${t.text}`}>{value}</div>
    </button>
  );
}

const PROGRAM_COLUMNS: Column<AuditProgram>[] = [
  {
    key: 'program_number',
    header: 'Program #',
    render: (r) => <span className="font-mono text-blue-600">{r.program_number}</span>,
  },
  {
    key: 'register',
    header: 'Register',
    sortable: false,
    render: (r) => (
      <div className="min-w-0">
        <div className="text-sm text-gray-900 truncate">{r.register.title}</div>
        <div className="text-[11px] text-gray-500 font-mono">
          {r.register.register_number}
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: false,
    render: (r) => <ProgramStatusBadge status={r.status as ProgramStatus} />,
  },
  {
    key: 'auditor',
    header: 'Auditor',
    sortable: false,
    render: (r) => r.register.auditor?.name ?? '—',
  },
  {
    key: 'planned',
    header: 'Planned',
    sortable: false,
    render: (r) =>
      r.register.planned_date
        ? new Date(r.register.planned_date).toLocaleDateString()
        : '—',
  },
  {
    key: 'findings_count',
    header: 'Findings',
    render: (r) => (
      <span
        className={`inline-flex items-center justify-center min-w-[26px] rounded-full px-2 py-0.5 text-xs font-semibold ${
          r.findings_count > 0
            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
            : 'bg-gray-100 text-gray-400'
        }`}
      >
        {r.findings_count}
      </span>
    ),
  },
];
