import { useNavigate } from 'react-router-dom';
import { Empty, Progress, Table, Tag } from 'antd';
import { CalendarClock } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import {
  useCalibrationSchedule,
  CRITICALITY_BADGE,
  STATUS_BADGE,
  fmtDate,
  type ScheduleEntry,
} from '@/lib/api/calibration';

export default function CalibrationSchedulePage() {
  const nav = useNavigate();
  const { data, isLoading } = useCalibrationSchedule(180);

  const overdue = data?.overdue ?? [];
  const upcoming = data?.upcoming ?? [];
  const maxMonth = Math.max(1, ...(data?.by_month ?? []).map((m) => m.count));

  const cols = [
    {
      title: 'Instrument',
      render: (_: unknown, r: ScheduleEntry) => (
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-blue-600">{r.code}</div>
          <div className="text-xs text-gray-800 truncate">{r.name}</div>
        </div>
      ),
    },
    {
      title: 'Criticality',
      width: 100,
      render: (_: unknown, r: ScheduleEntry) => (
        <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded border ${CRITICALITY_BADGE[r.criticality]}`}>
          {r.criticality}
        </span>
      ),
    },
    {
      title: 'Status',
      width: 145,
      render: (_: unknown, r: ScheduleEntry) => {
        const b = STATUS_BADGE[r.calibration_status];
        return <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border ${b.cls}`}>{b.label}</span>;
      },
    },
    {
      title: 'Due',
      width: 130,
      render: (_: unknown, r: ScheduleEntry) => {
        const od = r.due_at ? new Date(r.due_at) < new Date() : false;
        return <span className={`text-xs ${od ? 'text-red-600 font-semibold' : ''}`}>{fmtDate(r.due_at)}</span>;
      },
    },
  ];

  return (
    <PageContainer>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarClock size={22} className="text-gray-500" />
          Schedule
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Forward calibration load for the next 180 days. Records are created automatically ahead of the due date.
        </p>
      </div>

      {(data?.by_month.length ?? 0) > 0 && (
        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4 mb-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Load by month</h2>
          <div className="space-y-2">
            {data!.by_month.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-600 w-20">{m.month}</span>
                <Progress percent={Math.round((m.count / maxMonth) * 100)} size="small" showInfo={false} className="flex-1 !mb-0" />
                <span className="text-xs font-semibold text-gray-700 w-8 text-right">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-red-200 bg-white shadow-sm p-4 mb-4">
        <h2 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
          Overdue <Tag color="red">{overdue.length}</Tag>
        </h2>
        <Table<ScheduleEntry>
          size="small"
          rowKey="instrument_id"
          loading={isLoading}
          dataSource={overdue}
          columns={cols}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing overdue" /> }}
          onRow={(r) => ({ onClick: () => nav(`/calibration/instruments/${r.instrument_id}`), style: { cursor: 'pointer' } })}
        />
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Upcoming</h2>
        <Table<ScheduleEntry>
          size="small"
          rowKey="instrument_id"
          loading={isLoading}
          dataSource={upcoming}
          columns={cols}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing due in this window" /> }}
          onRow={(r) => ({ onClick: () => nav(`/calibration/instruments/${r.instrument_id}`), style: { cursor: 'pointer' } })}
        />
      </div>
    </PageContainer>
  );
}
