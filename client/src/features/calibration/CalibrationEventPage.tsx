import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Alert, Button, Descriptions, Empty, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag } from 'antd';
import { ArrowLeft, ClipboardCheck, Play, Send, CheckCircle2, XCircle, ShieldCheck, Plus, AlertTriangle } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useEvent,
  useAssignEvent,
  useAssignableUsers,
  useEventAction,
  useSaveReadings,
  useAddStandard,
  useUpdateEvent,
  useReferenceStandards,
  EVENT_STATUS_BADGE,
  OUTCOME_BADGE,
  fmtDate,
  fmtDateTime,
  type Reading,
  type Outcome,
} from '@/lib/api/calibration';

interface Draft {
  sequence: number;
  as_found_value: number | null;
  as_left_value: number | null;
  uncertainty: number | null;
}

export default function CalibrationEventPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { modal, message } = App.useApp();

  const { data: ev, isLoading } = useEvent(id);
  const { data: standards } = useReferenceStandards();

  const canPerform = useHasPermission('calibration_event.perform');
  const canReview = useHasPermission('calibration_event.review');
  const canApprove = useHasPermission('calibration_event.approve');

  const start = useEventAction('start');
  const submit = useEventAction('submit');
  const review = useEventAction('review');
  const approve = useEventAction('approve');
  const cancel = useEventAction('cancel');
  const assign = useAssignEvent();
  const { data: users } = useAssignableUsers();
  const saveReadings = useSaveReadings();
  const addStandard = useAddStandard();
  const updateEvent = useUpdateEvent(id ?? '');

  const [draft, setDraft] = useState<Draft[]>([]);
  const [stdOpen, setStdOpen] = useState(false);

  useEffect(() => {
    if (!ev?.readings) return;
    setDraft(
      ev.readings.map((r) => ({
        sequence: r.sequence,
        as_found_value: r.as_found_value,
        as_left_value: r.as_left_value,
        uncertainty: r.uncertainty,
      })),
    );
  }, [ev?.id, ev?.readings]);

  const editable = ev ? ['IN_PROGRESS', 'REJECTED'].includes(ev.status) : false;

  /** Live verdicts as the technician types — no round trip to see a red cell. */
  const verdicts = useMemo(() => {
    const map = new Map<number, { af: boolean | null; al: boolean | null }>();
    for (const r of ev?.readings ?? []) {
      const d = draft.find((x) => x.sequence === r.sequence);
      const inTol = (v: number | null | undefined) =>
        v === null || v === undefined ? null : v >= r.lower_limit && v <= r.upper_limit;
      map.set(r.sequence, { af: inTol(d?.as_found_value), al: inTol(d?.as_left_value) });
    }
    return map;
  }, [draft, ev?.readings]);

  if (isLoading || !ev) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const badge = EVENT_STATUS_BADGE[ev.status];
  const anyAsFoundFail = [...verdicts.values()].some((v) => v.af === false);

  const doSave = async () => {
    try {
      await saveReadings.mutateAsync({ id: ev.id, readings: draft });
      message.success('Readings saved and evaluated');
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  const confirmWithReason = (title: string, run: (reason: string) => Promise<unknown>) => {
    let reason = '';
    modal.confirm({
      title,
      centered: true,
      content: <Input.TextArea rows={3} placeholder="Reason" onChange={(e) => (reason = e.target.value)} />,
      onOk: async () => {
        if (!reason.trim()) {
          message.warning('A reason is required');
          throw new Error('reason');
        }
        await act(() => run(reason), 'Done');
      },
    });
  };

  return (
    <PageContainer>
      <Button type="text" icon={<ArrowLeft size={14} />} onClick={() => nav('/calibration/events')} className="!px-0 mb-2">
        Calibrations
      </Button>

      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardCheck size={22} className="text-gray-500" />
              {ev.event_no}
            </h1>
            <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border ${badge.cls}`}>{badge.label}</span>
            {ev.overall_outcome && (
              <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border ${OUTCOME_BADGE[ev.overall_outcome]}`}>
                {ev.overall_outcome}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            <a className="font-mono text-blue-600" onClick={() => nav(`/calibration/instruments/${ev.instrument_id}`)}>
              {ev.instrument_code}
            </a>{' '}
            — {ev.instrument_name} · {ev.type} · plan v{ev.plan_version ?? '—'}
          </p>
        </div>

        <Space wrap>
          {canPerform && ['PLANNED', 'SCHEDULED'].includes(ev.status) && (
            <Button type="primary" icon={<Play size={14} />} onClick={() => act(() => start.mutateAsync({ id: ev.id }), 'Calibration started')}>
              Start
            </Button>
          )}
          {canPerform && editable && (
            <>
              <Button onClick={doSave} loading={saveReadings.isPending}>
                Save readings
              </Button>
              <Button
                type="primary"
                icon={<Send size={14} />}
                onClick={async () => {
                  await doSave();
                  await act(() => submit.mutateAsync({ id: ev.id, body: {} }), 'Submitted');
                }}
              >
                Submit
              </Button>
            </>
          )}
          {canReview && ev.status === 'PENDING_REVIEW' && (
            <>
              <Button
                type="primary"
                icon={<CheckCircle2 size={14} />}
                onClick={() => act(() => review.mutateAsync({ id: ev.id, body: { decision: 'APPROVE' } }), 'Reviewed')}
              >
                Review &amp; sign
              </Button>
              <Button
                danger
                icon={<XCircle size={14} />}
                onClick={() => confirmWithReason('Reject this calibration?', (r) => review.mutateAsync({ id: ev.id, body: { decision: 'REJECT', reason: r } }))}
              >
                Reject
              </Button>
            </>
          )}
          {canApprove && ev.status === 'PENDING_APPROVAL' && (
            <Button
              type="primary"
              danger={ev.overall_outcome === 'FAIL'}
              icon={<ShieldCheck size={14} />}
              onClick={() =>
                act(
                  () => approve.mutateAsync({ id: ev.id, body: {} }),
                  ev.overall_outcome === 'FAIL'
                    ? 'Failure approved — instrument withdrawn from service'
                    : 'Approved — certificate issued',
                )
              }
            >
              {ev.overall_outcome === 'FAIL' ? 'Approve failure & withdraw' : 'Approve & issue certificate'}
            </Button>
          )}
          {!['APPROVED', 'CANCELLED'].includes(ev.status) && (
            <Button onClick={() => confirmWithReason('Cancel this calibration?', (r) => cancel.mutateAsync({ id: ev.id, body: { reason: r } }))}>
              Cancel
            </Button>
          )}
        </Space>
      </div>

      {ev.oot_id && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          icon={<AlertTriangle size={16} />}
          message="Out-of-tolerance impact assessment raised"
          description="This calibration cannot be approved until the impact assessment is closed."
          action={
            <Button size="small" onClick={() => nav(`/calibration/oot/${ev.oot_id}`)}>
              Open assessment
            </Button>
          }
        />
      )}
      {ev.overall_outcome === 'FAIL' && !['APPROVED', 'CANCELLED'].includes(ev.status) && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message="This calibration failed — no certificate will be issued"
          description="Approving it signs off the failure: the instrument is withdrawn from service and its calibration schedule is NOT advanced. It can only return to service after a passing after-repair calibration."
        />
      )}
      {ev.overall_outcome === 'FAIL' && ev.status === 'APPROVED' && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message="Failed calibration — non-conformance report"
          description="No conformity certificate exists for this record. The instrument was withdrawn from service and its due date was left unchanged."
        />
      )}
      {ev.rejection_reason && <Alert type="warning" showIcon className="mb-4" message="Rejected" description={ev.rejection_reason} />}
      {anyAsFoundFail && editable && (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="As-found reading out of tolerance"
          description="On submit, an impact assessment will be raised covering every record produced by this instrument since it last passed."
        />
      )}
      {(ev.standards?.some((s) => !s.was_valid_at_use) ?? false) && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message="A reference standard was not valid at the time of use"
          description="This breaks the traceability chain — resolve it before submitting."
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Descriptions bordered size="small" column={1} title="Execution" className="lg:col-span-2">
          <Descriptions.Item label="Assigned to">
            {['APPROVED', 'CANCELLED'].includes(ev.status) ? (
              <span>{users?.find((u) => u.id === ev.assigned_to_id)?.name ?? '—'}</span>
            ) : (
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                size="small"
                style={{ minWidth: 220 }}
                placeholder="Unassigned — nobody owns this"
                value={ev.assigned_to_id ?? undefined}
                onChange={(v) =>
                  act(() => assign.mutateAsync({ id: ev.id, assigned_to_id: v ?? null }), v ? 'Assigned' : 'Assignment cleared')
                }
                options={(users ?? []).map((u) => ({ value: u.id, label: u.name }))}
              />
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Method">
            {ev.method_ref ? (
              <span className="font-mono text-xs">{ev.method_ref}</span>
            ) : (
              <span className="text-gray-400 text-xs">not stated on the plan</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Scheduled">{fmtDate(ev.scheduled_for)}</Descriptions.Item>
          <Descriptions.Item label="Performed">{fmtDateTime(ev.performed_at)}</Descriptions.Item>
          <Descriptions.Item label="Performed by">
            {ev.performed_by_external ?? (ev.performed_by_id ? 'Internal user' : '—')}
            <Tag className="!ml-2 !text-[10px]">{ev.provider_type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Environment">
            {ev.ambient_temperature !== null || ev.ambient_humidity !== null ? (
              <Space>
                {ev.ambient_temperature !== null && <span>{ev.ambient_temperature} °C</span>}
                {ev.ambient_humidity !== null && <span>{ev.ambient_humidity} %RH</span>}
              </Space>
            ) : editable ? (
              <Space>
                <InputNumber size="small" placeholder="°C" onChange={(v) => updateEvent.mutate({ ambient_temperature: v })} />
                <InputNumber size="small" placeholder="%RH" onChange={(v) => updateEvent.mutate({ ambient_humidity: v })} />
              </Space>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Outcomes">
            <Space>
              <OutcomeChip label="As found" v={ev.as_found_outcome} />
              <OutcomeChip label="As left" v={ev.as_left_outcome} />
              <OutcomeChip label="Overall" v={ev.overall_outcome} />
              {ev.adjustment_made && <Tag color="orange" className="!text-[10px]">adjusted</Tag>}
            </Space>
          </Descriptions.Item>
          {ev.certificate_no && <Descriptions.Item label="Certificate">{ev.certificate_no}</Descriptions.Item>}
          {ev.next_due_at && <Descriptions.Item label="Next due">{fmtDate(ev.next_due_at)}</Descriptions.Item>}
        </Descriptions>

        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Reference standards</h3>
            {canPerform && editable && (
              <Button size="small" icon={<Plus size={11} />} onClick={() => setStdOpen(true)}>
                Add
              </Button>
            )}
          </div>
          {(ev.standards?.length ?? 0) === 0 ? (
            <p className="text-[11px] text-gray-400">
              None recorded. Traceability to a national standard is required in every regime.
            </p>
          ) : (
            <div className="space-y-2">
              {ev.standards!.map((s) => {
                const std = standards?.data.find((x) => x.id === s.standard_instrument_id);
                return (
                  <div key={s.id} className="text-[11px] border-b border-gray-100 pb-1.5 last:border-0">
                    <div className="font-mono text-blue-600">{std?.code ?? s.standard_instrument_id.slice(0, 8)}</div>
                    <div className="text-gray-600">{std?.name}</div>
                    <div className="text-gray-400">
                      {s.certificate_no ?? 'no cert. no.'} · {s.traceable_to ?? 'traceability not stated'}
                    </div>
                    {!s.was_valid_at_use && <Tag color="red" className="!text-[9px] !mt-1">lapsed at time of use</Tag>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Readings</h3>
        <p className="text-[11px] text-gray-500 mb-3">
          As-found is recorded <em>before</em> any adjustment — it is the only field that says whether the period behind
          this calibration is trustworthy. Pass/fail is computed from the stored limits, never entered.
        </p>

        <Table<Reading>
          size="small"
          rowKey="sequence"
          pagination={false}
          dataSource={ev.readings ?? []}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No points on this record" /> }}
          columns={[
            { title: '#', dataIndex: 'sequence', width: 40 },
            { title: 'Point', dataIndex: 'label', ellipsis: true },
            {
              title: 'Nominal',
              width: 110,
              align: 'right' as const,
              render: (_: unknown, r) => (
                <span className="font-mono text-xs">
                  {r.nominal_value} {r.unit_code ?? ''}
                </span>
              ),
            },
            {
              title: 'Limits',
              width: 170,
              align: 'right' as const,
              render: (_: unknown, r) => (
                <span className="font-mono text-[11px] text-gray-500">
                  {r.lower_limit} … {r.upper_limit}
                </span>
              ),
            },
            {
              title: 'As found',
              width: 130,
              render: (_: unknown, r) => {
                const d = draft.find((x) => x.sequence === r.sequence);
                const v = verdicts.get(r.sequence)?.af;
                return editable ? (
                  <InputNumber
                    size="small"
                    value={d?.as_found_value ?? undefined}
                    onChange={(val) =>
                      setDraft((p) => p.map((x) => (x.sequence === r.sequence ? { ...x, as_found_value: val ?? null } : x)))
                    }
                    className={`w-full ${v === false ? '!border-red-400 !bg-red-50' : v === true ? '!border-emerald-300' : ''}`}
                  />
                ) : (
                  <ValueCell value={r.as_found_value} inTol={r.as_found_in_tolerance} error={r.as_found_error} />
                );
              },
            },
            {
              title: 'As left',
              width: 130,
              render: (_: unknown, r) => {
                const d = draft.find((x) => x.sequence === r.sequence);
                const v = verdicts.get(r.sequence)?.al;
                return editable ? (
                  <InputNumber
                    size="small"
                    value={d?.as_left_value ?? undefined}
                    onChange={(val) =>
                      setDraft((p) => p.map((x) => (x.sequence === r.sequence ? { ...x, as_left_value: val ?? null } : x)))
                    }
                    className={`w-full ${v === false ? '!border-red-400 !bg-red-50' : v === true ? '!border-emerald-300' : ''}`}
                  />
                ) : (
                  <ValueCell value={r.as_left_value} inTol={r.as_left_in_tolerance} error={r.as_left_error} />
                );
              },
            },
            {
              title: 'U (k=2)',
              width: 100,
              render: (_: unknown, r) => {
                const d = draft.find((x) => x.sequence === r.sequence);
                return editable ? (
                  <InputNumber
                    size="small"
                    value={d?.uncertainty ?? undefined}
                    onChange={(val) =>
                      setDraft((p) => p.map((x) => (x.sequence === r.sequence ? { ...x, uncertainty: val ?? null } : x)))
                    }
                    className="w-full"
                  />
                ) : (
                  <span className="font-mono text-xs">{r.uncertainty ?? '—'}</span>
                );
              },
            },
          ]}
        />
      </div>

      <AddStandardModal open={stdOpen} onClose={() => setStdOpen(false)} eventId={ev.id} />
    </PageContainer>
  );
}

function ValueCell({ value, inTol, error }: { value: number | null; inTol: boolean | null; error: number | null }) {
  if (value === null) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div>
      <div className={`font-mono text-xs font-semibold ${inTol === false ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      {error !== null && <div className="text-[10px] text-gray-400">err {error}</div>}
    </div>
  );
}

function OutcomeChip({ label, v }: { label: string; v: Outcome | null }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] text-gray-400">{label}</span>
      {v ? (
        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border ${OUTCOME_BADGE[v]}`}>{v}</span>
      ) : (
        <span className="text-[10px] text-gray-400">—</span>
      )}
    </span>
  );
}

function AddStandardModal({ open, onClose, eventId }: { open: boolean; onClose: () => void; eventId: string }) {
  const { message } = App.useApp();
  const { data: standards } = useReferenceStandards();
  const add = useAddStandard();
  const [stdId, setStdId] = useState<string | undefined>();
  const [certNo, setCertNo] = useState('');
  const [traceable, setTraceable] = useState('');

  const save = async () => {
    if (!stdId) return message.warning('Select a reference standard');
    try {
      await add.mutateAsync({ id: eventId, standard_instrument_id: stdId, certificate_no: certNo || null, traceable_to: traceable || null });
      message.success('Standard recorded');
      setStdId(undefined);
      setCertNo('');
      setTraceable('');
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  return (
    <Modal open={open} onCancel={onClose} onOk={save} okText="Add" title="Record reference standard used" centered confirmLoading={add.isPending}>
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Reference standard</label>
          <Select
            className="w-full"
            value={stdId}
            onChange={setStdId}
            placeholder="Select…"
            options={(standards?.data ?? []).map((s) => ({
              value: s.id,
              label: `${s.code} — ${s.name}${s.is_lapsed ? ' (LAPSED)' : ''}`,
              disabled: s.is_lapsed,
            }))}
          />
          <p className="text-[10px] text-gray-400 mt-1">Lapsed standards are disabled — using one invalidates the calibration.</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Certificate no.</label>
          <Input value={certNo} onChange={(e) => setCertNo(e.target.value)} placeholder="NABL/CC/2026/11482" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Traceable to</label>
          <Input value={traceable} onChange={(e) => setTraceable(e.target.value)} placeholder="NABL / NPL India" />
        </div>
      </div>
    </Modal>
  );
}
