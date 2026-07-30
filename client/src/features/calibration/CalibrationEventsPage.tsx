import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Empty, Input, Select, Table } from 'antd';
import { ClipboardCheck, Search } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import {
  useEvents,
  EVENT_STATUS_BADGE,
  OUTCOME_BADGE,
  fmtDate,
  type CalibrationEvent,
  type EventStatus,
} from '@/lib/api/calibration';

const OPEN_STATES = 'PLANNED,SCHEDULED,IN_PROGRESS,PENDING_REVIEW,PENDING_APPROVAL';

export default function CalibrationEventsPage() {
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(OPEN_STATES);

  const { data, isLoading } = useEvents({ search: search || undefined, status });
  const rows = data?.data ?? [];

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck size={22} className="text-gray-500" />
            Calibrations
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Execution records — readings, traceable standards, review and approval.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 180 }}
            options={[
              { value: OPEN_STATES, label: 'Open (all stages)' },
              { value: 'IN_PROGRESS', label: 'In progress' },
              { value: 'PENDING_REVIEW', label: 'Pending review' },
              { value: 'PENDING_APPROVAL', label: 'Pending approval' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: undefined as unknown as string, label: 'All' },
            ]}
          />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input
              placeholder="Record / certificate / instrument…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              style={{ width: 260 }}
            />
          </div>
        </div>
      </div>

      <Table<CalibrationEvent>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 25, showSizeChanger: false, showTotal: (t) => `${t} record(s)` }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No calibration records" /> }}
        onRow={(r) => ({ onClick: () => nav(`/calibration/events/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Record',
            dataIndex: 'event_no',
            width: 155,
            render: (v: string) => <span className="font-mono text-xs text-blue-600">{v}</span>,
          },
          {
            title: 'Instrument',
            ellipsis: true,
            render: (_: unknown, r) => (
              <div className="min-w-0">
                <div className="font-mono text-[11px] text-gray-500">{r.instrument_code}</div>
                <div className="text-xs text-gray-800 truncate">{r.instrument_name}</div>
              </div>
            ),
          },
          { title: 'Type', dataIndex: 'type', width: 110, render: (v: string) => <span className="text-xs">{v}</span> },
          {
            title: 'Scheduled',
            width: 120,
            render: (_: unknown, r) => (
              <span className={`text-xs ${r.is_overdue ? 'text-red-600 font-semibold' : ''}`}>{fmtDate(r.scheduled_for)}</span>
            ),
          },
          { title: 'Performed', width: 120, render: (_: unknown, r) => <span className="text-xs">{fmtDate(r.performed_at)}</span> },
          {
            title: 'As-found',
            width: 95,
            render: (_: unknown, r) =>
              r.as_found_outcome ? (
                <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded border ${OUTCOME_BADGE[r.as_found_outcome]}`}>
                  {r.as_found_outcome}
                </span>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              ),
          },
          {
            title: 'Status',
            width: 145,
            render: (_: unknown, r) => {
              const b = EVENT_STATUS_BADGE[r.status as EventStatus];
              return <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border ${b.cls}`}>{b.label}</span>;
            },
          },
          {
            title: 'OOT',
            width: 60,
            render: (_: unknown, r) =>
              r.oot_id ? <span className="text-red-600 text-[11px] font-bold">yes</span> : <span className="text-gray-300 text-xs">—</span>,
          },
        ]}
      />
    </PageContainer>
  );
}
