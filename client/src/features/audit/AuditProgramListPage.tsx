import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Table } from 'antd';
import { Search, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuditPrograms, type AuditProgram, type ProgramStatus } from '@/lib/api/audit';
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
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { data, isLoading } = useAuditPrograms({
    status: status === 'ALL' ? undefined : status,
    search: search || undefined,
  });
  const rows = data?.data ?? [];

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Audit Program</h2>
          <p className="text-xs text-gray-500">
            Approved audits ready to start or in execution.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                status === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
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
            style={{ width: 260 }}
          />
        </div>
      </div>

      <Table<AuditProgram>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({
          onClick: () => nav(`/audit/program/${r.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          {
            title: 'Program #',
            dataIndex: 'program_number',
            width: 140,
            render: (v: string) => <span className="font-mono text-blue-600">{v}</span>,
          },
          {
            title: 'Register',
            render: (_: unknown, r) => (
              <div className="min-w-0">
                <div className="text-sm text-gray-900 truncate">{r.register.title}</div>
                <div className="text-[11px] text-gray-500 font-mono">
                  {r.register.register_number}
                </div>
              </div>
            ),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 130,
            render: (v: ProgramStatus) => <ProgramStatusBadge status={v} />,
          },
          {
            title: 'Auditor',
            render: (_: unknown, r) => r.register.auditor?.name ?? '—',
            width: 130,
          },
          {
            title: 'Planned',
            render: (_: unknown, r) =>
              r.register.planned_date
                ? new Date(r.register.planned_date).toLocaleDateString()
                : '—',
            width: 110,
          },
          {
            title: 'Findings',
            dataIndex: 'findings_count',
            width: 90,
            render: (v: number) => (
              <span className="text-sm font-semibold text-gray-700">{v}</span>
            ),
          },
        ]}
      />

      {/* Schedule — recurrence rules + calendar, collapsible below the list. */}
      <div className="mt-6 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={() => setScheduleOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-blue-700"
        >
          {scheduleOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <CalendarDays size={15} className="text-gray-500" />
          Audit Schedule
          <span className="text-xs font-normal text-gray-500">
            recurrence rules &amp; planned-audit calendar
          </span>
        </button>

        {scheduleOpen && (
          <div className="mt-4">
            <AuditSchedulePage />
          </div>
        )}
      </div>
    </>
  );
}
