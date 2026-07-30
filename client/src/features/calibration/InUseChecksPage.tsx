import { useState } from 'react';
import { Alert, App, Button, Empty, Input, Modal, Space, Switch, Table, Tag } from 'antd';
import { Repeat, Plus, Clock } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useChecks,
  useDueChecks,
  useCreateCheck,
  OUTCOME_BADGE,
  fmtDateTime,
  type Check,
  type DueCheck,
} from '@/lib/api/calibration';

/**
 * In-use verification — the shift/daily control.
 *
 * The reason this page matters: a FAILED check computes the product-hold window
 * back to the last PASSING check, and the result of that calculation is shown
 * immediately rather than buried in a record somewhere.
 */
export default function InUseChecksPage() {
  const { data: due } = useDueChecks();
  const { data: history, isLoading } = useChecks();
  const canCreate = useHasPermission('calibration_check.create');
  const [target, setTarget] = useState<DueCheck | null>(null);

  return (
    <PageContainer>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Repeat size={22} className="text-gray-500" />
          In-Use Checks
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Shift and daily verification of monitoring devices. A failed check puts product on hold back to the last
          passing one.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-white shadow-sm p-4 mb-4">
        <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Clock size={15} className="text-amber-600" />
          Due now <Tag color={due?.total ? 'orange' : 'green'}>{due?.total ?? 0}</Tag>
        </h2>
        <Table<DueCheck>
          size="small"
          rowKey="instrument_id"
          dataSource={due?.data ?? []}
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="All checks up to date" /> }}
          columns={[
            {
              title: 'Instrument',
              render: (_: unknown, r) => (
                <div>
                  <div className="font-mono text-[11px] text-blue-600">{r.code}</div>
                  <div className="text-xs text-gray-800">{r.name}</div>
                </div>
              ),
            },
            { title: 'Category', dataIndex: 'category_name', width: 180, ellipsis: true },
            { title: 'Frequency', dataIndex: 'frequency', width: 110, render: (v: string | null) => <Tag className="!text-[10px]">{v ?? '—'}</Tag> },
            {
              title: 'Last check',
              width: 190,
              render: (_: unknown, r) => (
                <span className="text-xs">
                  {fmtDateTime(r.last_check_at)}
                  {r.hours_since_last !== null && <span className="text-gray-400 ml-1">({r.hours_since_last}h ago)</span>}
                </span>
              ),
            },
            {
              title: '',
              width: 110,
              render: (_: unknown, r) =>
                canCreate ? (
                  <Button size="small" type="primary" icon={<Plus size={11} />} onClick={() => setTarget(r)}>
                    Record
                  </Button>
                ) : null,
            },
          ]}
        />
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Recent checks</h2>
        <Table<Check>
          size="small"
          rowKey="id"
          loading={isLoading}
          dataSource={history?.data ?? []}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No checks recorded" /> }}
          columns={[
            { title: 'When', width: 175, render: (_: unknown, r) => <span className="text-xs">{fmtDateTime(r.performed_at)}</span> },
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
            { title: 'Shift', dataIndex: 'shift', width: 65, render: (v: string | null) => v ?? '—' },
            {
              title: 'Outcome',
              width: 90,
              render: (_: unknown, r) => (
                <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded border ${OUTCOME_BADGE[r.outcome]}`}>{r.outcome}</span>
              ),
            },
            { title: 'Batch', dataIndex: 'batch_ref', width: 120, render: (v: string | null) => <span className="font-mono text-xs">{v ?? '—'}</span> },
            {
              title: 'Hold',
              render: (_: unknown, r) =>
                r.hold_triggered ? (
                  <span className="text-[11px] text-red-600 font-semibold">
                    from {fmtDateTime(r.hold_window_from)} {r.hold_ref && `· ${r.hold_ref}`}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                ),
            },
          ]}
        />
      </div>

      <CheckModal target={target} onClose={() => setTarget(null)} />
    </PageContainer>
  );
}

function CheckModal({ target, onClose }: { target: DueCheck | null; onClose: () => void }) {
  const { message } = App.useApp();
  const create = useCreateCheck();
  const [shift, setShift] = useState('');
  const [batch, setBatch] = useState('');
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState<{ label: string; observed: string; in_tolerance: boolean }[]>([
    { label: 'Test piece / check weight', observed: '', in_tolerance: true },
  ]);

  const save = async () => {
    if (!target) return;
    if (rows.some((r) => !r.label.trim())) return message.warning('Every reading needs a label');
    try {
      const res = await create.mutateAsync({
        id: target.instrument_id,
        shift: shift || null,
        batch_ref: batch || null,
        remarks: remarks || null,
        readings: rows.map((r) => ({
          label: r.label,
          observed: r.observed === '' ? null : Number(r.observed),
          in_tolerance: r.in_tolerance,
        })),
      });
      if (res.hold_window) {
        Modal.error({
          title: 'Check FAILED — product hold window',
          centered: true,
          content: (
            <div className="text-sm">
              <p className="mb-2">{res.hold_window.note}</p>
              <p className="font-mono text-xs">
                {fmtDateTime(res.hold_window.from)} → {fmtDateTime(res.hold_window.to)}
              </p>
              {res.hold_window.hours !== null && <p className="text-xs text-gray-500 mt-1">{res.hold_window.hours} hours of production</p>}
            </div>
          ),
        });
      } else {
        message.success('Check recorded');
      }
      setRows([{ label: 'Test piece / check weight', observed: '', in_tolerance: true }]);
      setShift('');
      setBatch('');
      setRemarks('');
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  const anyFail = rows.some((r) => !r.in_tolerance);

  return (
    <Modal
      open={!!target}
      onCancel={onClose}
      onOk={save}
      okText="Record check"
      okButtonProps={{ danger: anyFail }}
      confirmLoading={create.isPending}
      title={target ? `Verification — ${target.code}` : ''}
      centered
      width={560}
    >
      {anyFail && (
        <Alert
          type="error"
          showIcon
          className="mb-3"
          message="This will be recorded as a FAILED check"
          description="A product-hold window back to the last passing check will be computed and the device taken out of service."
        />
      )}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Shift</label>
            <Input value={shift} onChange={(e) => setShift(e.target.value)} placeholder="A / B / C" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Batch running</label>
            <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="B-26071" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-gray-600">Readings</label>
            <Button size="small" icon={<Plus size={11} />} onClick={() => setRows((r) => [...r, { label: '', observed: '', in_tolerance: true }])}>
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  size="small"
                  placeholder="Label"
                  value={r.label}
                  onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  className="flex-1"
                />
                <Input
                  size="small"
                  placeholder="Observed"
                  value={r.observed}
                  onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, observed: e.target.value } : x)))}
                  style={{ width: 110 }}
                />
                <Space size={4}>
                  <Switch
                    size="small"
                    checked={r.in_tolerance}
                    onChange={(v) => setRows((p) => p.map((x, j) => (j === i ? { ...x, in_tolerance: v } : x)))}
                  />
                  <span className={`text-[10px] font-semibold ${r.in_tolerance ? 'text-emerald-600' : 'text-red-600'}`}>
                    {r.in_tolerance ? 'pass' : 'fail'}
                  </span>
                </Space>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Remarks</label>
          <Input.TextArea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
