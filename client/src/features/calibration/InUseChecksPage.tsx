import { useEffect, useState } from 'react';
import { Alert, App, Button, Empty, Input, InputNumber, Modal, Space, Spin, Switch, Table, Tag } from 'antd';
import { Repeat, Plus, Clock } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import CalibrationPageHeader from './CalibrationPageHeader';
import { useHasPermission } from '@/stores/authStore';
import {
  useChecks,
  useDueChecks,
  useCreateCheck,
  useCheckTemplate,
  type CheckTemplateItem,
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
      <CalibrationPageHeader
        title="In-Use Checks"
        icon={Repeat}
      />

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
  const { data: template, isLoading } = useCheckTemplate(target?.instrument_id);

  const [shift, setShift] = useState('');
  const [batch, setBatch] = useState('');
  const [remarks, setRemarks] = useState('');
  /** Keyed by template item id; free-form rows use their index. */
  const [values, setValues] = useState<Record<string, { observed?: number | null; passed?: boolean }>>({});

  // Load this instrument's own checklist whenever the modal opens on a new one.
  useEffect(() => {
    setValues({});
    setShift('');
    setBatch('');
    setRemarks('');
  }, [target?.instrument_id]);

  const items = template?.items ?? [];

  /** Live verdict, mirroring what the server will compute on submit. */
  const verdict = (it: CheckTemplateItem): boolean | null => {
    const v = values[it.id];
    if (it.check_type === 'PASS_FAIL') return v?.passed === undefined ? null : v.passed;
    if (v?.observed === null || v?.observed === undefined) return null;
    if (it.nominal_value === null || it.tolerance_value === null) return true;
    return Math.abs(v.observed - it.nominal_value) <= Math.abs(it.tolerance_value);
  };

  const anyFail = items.some((it) => verdict(it) === false);
  const missingRequired = items.filter((it) => it.is_required && verdict(it) === null);

  const save = async () => {
    if (!target) return;
    if (!template?.available) return message.warning('This instrument has no checklist defined');
    if (missingRequired.length) {
      return message.warning(`Complete every required check: ${missingRequired.map((m) => m.label).join(', ')}`);
    }
    try {
      const res = await create.mutateAsync({
        id: target.instrument_id,
        shift: shift || null,
        batch_ref: batch || null,
        remarks: remarks || null,
        readings: items.map((it) => ({
          item_id: it.id,
          label: it.label,
          check_type: it.check_type,
          nominal: it.nominal_value,
          tolerance: it.tolerance_value,
          unit_code: it.unit_code,
          observed: it.check_type === 'NUMERIC' ? values[it.id]?.observed ?? null : null,
          passed: it.check_type === 'PASS_FAIL' ? values[it.id]?.passed === true : undefined,
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
              {res.hold_window.hours !== null && (
                <p className="text-xs text-gray-500 mt-1">{res.hold_window.hours} hours of production</p>
              )}
            </div>
          ),
        });
      } else {
        message.success('Check recorded');
      }
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  return (
    <Modal
      open={!!target}
      onCancel={onClose}
      onOk={save}
      okText="Record check"
      okButtonProps={{ danger: anyFail, disabled: !template?.available }}
      confirmLoading={create.isPending}
      title={
        target ? (
          <div>
            <div>{`${target.code} — ${target.name}`}</div>
            {template?.category_name && (
              <div className="text-[11px] font-normal text-gray-500">
                {template.category_name}
                {template.frequency && ` · ${template.frequency.toLowerCase().replace('_', ' ')} check`}
              </div>
            )}
          </div>
        ) : (
          ''
        )
      }
      centered
      width={640}
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : !template?.available ? (
        <Alert type="warning" showIcon message="No checklist defined" description={template?.reason} />
      ) : (
        <div className="space-y-3">
          {anyFail && (
            <Alert
              type="error"
              showIcon
              message="This will be recorded as a FAILED check"
              description="A product-hold window back to the last passing check will be computed and the device taken out of service."
            />
          )}

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

          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {items.map((it) => {
              const v = verdict(it);
              return (
                <div key={it.id} className="p-2.5 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-gray-800">
                      {it.label}
                      {it.is_required && <span className="text-red-500 ml-0.5">*</span>}
                    </div>
                    {it.check_type === 'NUMERIC' && it.nominal_value !== null && (
                      <div className="text-[10px] text-gray-400 font-mono">
                        expect {it.nominal_value}
                        {it.tolerance_value !== null && ` ± ${it.tolerance_value}`} {it.unit_code ?? ''}
                      </div>
                    )}
                    {it.guidance && <div className="text-[10px] text-gray-500 leading-snug mt-0.5">{it.guidance}</div>}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {it.check_type === 'NUMERIC' ? (
                      <InputNumber
                        size="small"
                        style={{ width: 110 }}
                        placeholder={it.unit_code ?? 'value'}
                        value={values[it.id]?.observed ?? undefined}
                        onChange={(val) => setValues((p) => ({ ...p, [it.id]: { ...p[it.id], observed: val } }))}
                        className={v === false ? '!border-red-400 !bg-red-50' : v === true ? '!border-emerald-300' : ''}
                      />
                    ) : (
                      <Space size={4}>
                        <Switch
                          size="small"
                          checked={values[it.id]?.passed === true}
                          onChange={(on) => setValues((p) => ({ ...p, [it.id]: { ...p[it.id], passed: on } }))}
                        />
                        <span className={`text-[10px] font-semibold ${v === true ? 'text-emerald-600' : v === false ? 'text-red-600' : 'text-gray-400'}`}>
                          {v === null ? '—' : v ? 'pass' : 'fail'}
                        </span>
                      </Space>
                    )}
                    <span className="w-4 text-center">
                      {v === true && <span className="text-emerald-600 text-xs">✓</span>}
                      {v === false && <span className="text-red-600 text-xs">✗</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {missingRequired.length > 0 && (
            <p className="text-[11px] text-amber-700">
              {missingRequired.length} required check(s) still to complete.
            </p>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Remarks</label>
            <Input.TextArea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
