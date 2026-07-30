import { useNavigate } from 'react-router-dom';
import { Alert, Empty, Table, Tag } from 'antd';
import { ShieldCheck } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useReferenceStandards, STATUS_BADGE, fmtDate } from '@/lib/api/calibration';

export default function ReferenceStandardsPage() {
  const nav = useNavigate();
  const { data, isLoading } = useReferenceStandards();
  const rows = data?.data ?? [];
  const lapsed = rows.filter((r) => r.is_lapsed);

  return (
    <PageContainer>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck size={22} className="text-gray-500" />
          Reference Standards
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          The instruments other instruments are measured against. A standard is itself calibrated on an interval — and a
          lapsed one retroactively weakens every calibration it backed.
        </p>
      </div>

      {lapsed.length > 0 && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message={`${lapsed.length} standard(s) past their own due date`}
          description={`${lapsed.map((l) => l.code).join(', ')} — calibrations performed with these have no valid traceability.`}
        />
      )}

      <Table
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No reference standards registered — add an instrument with kind 'Reference standard'"
            />
          ),
        }}
        onRow={(r) => ({ onClick: () => nav(`/calibration/instruments/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-xs text-blue-600">{v}</span> },
          {
            title: 'Standard',
            ellipsis: true,
            render: (_: unknown, r) => (
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">{r.name}</div>
                <div className="text-[10px] text-gray-400">{[r.manufacturer, r.serial_no].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            ),
          },
          { title: 'Category', dataIndex: 'category_name', width: 170, ellipsis: true, render: (v: string | null) => <span className="text-xs">{v ?? '—'}</span> },
          { title: 'Location', dataIndex: 'location', width: 160, ellipsis: true, render: (v: string | null) => <span className="text-xs">{v ?? '—'}</span> },
          {
            title: 'Status',
            width: 145,
            render: (_: unknown, r) => {
              const b = STATUS_BADGE[r.calibration_status];
              return <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border ${b.cls}`}>{b.label}</span>;
            },
          },
          {
            title: 'Own due date',
            width: 140,
            render: (_: unknown, r) => (
              <span className={`text-xs ${r.is_lapsed ? 'text-red-600 font-semibold' : ''}`}>
                {fmtDate(r.calibration_due_at)}
                {r.is_lapsed && <Tag color="red" className="!ml-1 !text-[9px]">lapsed</Tag>}
              </span>
            ),
          },
          {
            title: 'Used in',
            width: 90,
            align: 'right' as const,
            render: (_: unknown, r) => <span className="text-xs font-semibold">{r.times_used}</span>,
          },
        ]}
      />
    </PageContainer>
  );
}
