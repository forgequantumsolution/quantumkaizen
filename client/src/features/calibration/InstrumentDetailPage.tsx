import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Descriptions, Empty, Input, Modal, Space, Spin, Table, Tabs, Tag } from 'antd';
import { ArrowLeft, Ruler, Play, Ban, RotateCcw, Archive, QrCode, TrendingUp } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useInstrument,
  useInstrumentHistory,
  useInstrumentDrift,
  useInstrumentLabel,
  useInstrumentAction,
  usePlans,
  useCreateEvent,
  STATUS_BADGE,
  CRITICALITY_BADGE,
  KIND_LABELS,
  EVENT_STATUS_BADGE,
  OUTCOME_BADGE,
  fmtDate,
  fmtDateTime,
  type Outcome,
  type EventStatus,
} from '@/lib/api/calibration';
import PlanEditor from './PlanEditor';

export default function InstrumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { modal, message } = App.useApp();

  const { data: inst, isLoading } = useInstrument(id);
  const { data: history } = useInstrumentHistory(id);
  const { data: drift } = useInstrumentDrift(id);
  const { data: plans } = usePlans(id);

  const canUpdate = useHasPermission('calibration_instrument.update');
  const canRetire = useHasPermission('calibration_instrument.retire');
  const canCreateEvent = useHasPermission('calibration_event.create');

  const retire = useInstrumentAction('retire');
  const oos = useInstrumentAction('out-of-service');
  const rts = useInstrumentAction('return-to-service');
  const createEvent = useCreateEvent();
  const [labelOpen, setLabelOpen] = useState(false);

  if (isLoading || !inst) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const badge = STATUS_BADGE[inst.calibration_status];

  const withReason = (title: string, run: (reason: string) => Promise<unknown>) => {
    let reason = '';
    modal.confirm({
      title,
      centered: true,
      content: (
        <Input.TextArea rows={3} placeholder="Reason (recorded in the audit trail)" onChange={(e) => (reason = e.target.value)} />
      ),
      onOk: async () => {
        if (!reason.trim()) {
          message.warning('A reason is required');
          throw new Error('reason required');
        }
        try {
          await run(reason);
          message.success('Done');
        } catch (e) {
          message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
          throw e;
        }
      },
    });
  };

  const startCalibration = async () => {
    try {
      const ev = await createEvent.mutateAsync({ instrument_id: inst.id, type: 'PERIODIC' });
      message.success(`${ev.event_no} created`);
      nav(`/calibration/events/${ev.id}`);
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  return (
    <PageContainer>
      <Button type="text" icon={<ArrowLeft size={14} />} onClick={() => nav('/calibration/instruments')} className="!px-0 mb-2">
        Instruments
      </Button>

      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Ruler size={22} className="text-gray-500" />
              {inst.name}
            </h1>
            <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border ${badge.cls}`}>{badge.label}</span>
            <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded border ${CRITICALITY_BADGE[inst.criticality]}`}>
              {inst.criticality}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            <span className="font-mono text-blue-600">{inst.code}</span>
            {inst.serial_no && <> · S/N {inst.serial_no}</>}
            {inst.location && <> · {inst.location}</>}
            {' · '}
            {KIND_LABELS[inst.kind]}
          </p>
        </div>

        <Space wrap>
          <Button icon={<QrCode size={14} />} onClick={() => setLabelOpen(true)}>
            Label
          </Button>
          {canCreateEvent && inst.status === 'ACTIVE' && !inst.open_event && (
            <Button type="primary" icon={<Play size={14} />} onClick={startCalibration} loading={createEvent.isPending}>
              Start calibration
            </Button>
          )}
          {inst.open_event && (
            <Button type="primary" onClick={() => nav(`/calibration/events/${inst.open_event!.id}`)}>
              Open {inst.open_event.event_no}
            </Button>
          )}
          {canUpdate && inst.status === 'ACTIVE' && (
            <Button danger icon={<Ban size={14} />} onClick={() => withReason('Take out of service?', (r) => oos.mutateAsync({ id: inst.id, reason: r }))}>
              Out of service
            </Button>
          )}
          {canUpdate && inst.status === 'OUT_OF_SERVICE' && (
            <Button icon={<RotateCcw size={14} />} onClick={() => withReason('Return to service?', (r) => rts.mutateAsync({ id: inst.id, reason: r }))}>
              Return to service
            </Button>
          )}
          {canRetire && inst.status !== 'RETIRED' && (
            <Button icon={<Archive size={14} />} onClick={() => withReason('Retire this instrument?', (r) => retire.mutateAsync({ id: inst.id, reason: r }))}>
              Retire
            </Button>
          )}
        </Space>
      </div>

      {inst.blocked_for_use && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message="This instrument must not be used to produce data"
          description={`It is ${badge.label.toLowerCase()}. The site's calibration configuration blocks use in this state until calibration is restored.`}
        />
      )}
      {inst.open_oot_count > 0 && (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message={`${inst.open_oot_count} open out-of-tolerance assessment(s)`}
          description="Data produced by this instrument in the affected window is under review."
          action={
            <Button size="small" onClick={() => nav(`/calibration/oot?instrument=${inst.id}`)}>
              Review
            </Button>
          }
        />
      )}
      {!inst.active_plan && inst.is_calibration_required && (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="No calibration plan"
          description="Without a plan there is no schedule and no tolerance to judge readings against."
        />
      )}

      <Tabs
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Descriptions bordered size="small" column={1} title="Identification">
                  <Descriptions.Item label="Code">{inst.code}</Descriptions.Item>
                  <Descriptions.Item label="Category">{inst.category_name ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Manufacturer / model">
                    {[inst.manufacturer, inst.model].filter(Boolean).join(' / ') || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Serial no.">{inst.serial_no ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Asset tag">{inst.asset_tag ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Location">{inst.location ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Site / department">
                    {[inst.site_name, inst.department_name].filter(Boolean).join(' / ') || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Custodian">{inst.custodian_name ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="LIMS link">
                    {inst.lims_equipment_id ? (
                      <Tag color="blue" className="!text-[10px]">linked</Tag>
                    ) : (
                      <span className="text-gray-400 text-xs">not linked — impact scan uses batch references</span>
                    )}
                  </Descriptions.Item>
                </Descriptions>

                <div className="space-y-4">
                  <Descriptions bordered size="small" column={1} title="Metrology">
                    <Descriptions.Item label="Range">
                      {inst.measurement_range_min !== null && inst.measurement_range_max !== null
                        ? `${inst.measurement_range_min} – ${inst.measurement_range_max} ${inst.unit_code ?? ''}`
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Resolution">{inst.resolution ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Accuracy class">{inst.accuracy_class ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="MPE">{inst.mpe ?? '—'}</Descriptions.Item>
                    {inst.aiq_group && <Descriptions.Item label="USP ⟨1058⟩ group">{inst.aiq_group}</Descriptions.Item>}
                    {inst.gamp_category && <Descriptions.Item label="GAMP category">{inst.gamp_category}</Descriptions.Item>}
                    {inst.legal_metrology_stamp_no && (
                      <Descriptions.Item label="Legal metrology stamp">
                        {inst.legal_metrology_stamp_no} (valid to {fmtDate(inst.legal_metrology_valid_until)})
                      </Descriptions.Item>
                    )}
                  </Descriptions>

                  <Descriptions bordered size="small" column={1} title="Calibration">
                    <Descriptions.Item label="Last calibrated">{fmtDate(inst.last_calibrated_at)}</Descriptions.Item>
                    <Descriptions.Item label="Next due">
                      <span className={(inst.days_until_due ?? 1) < 0 ? 'text-red-600 font-semibold' : ''}>
                        {fmtDate(inst.calibration_due_at)}
                        {inst.days_until_due !== null && (
                          <span className="text-gray-400 ml-1 text-[11px]">
                            ({inst.days_until_due < 0 ? `${-inst.days_until_due}d overdue` : `in ${inst.days_until_due}d`})
                          </span>
                        )}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Interval">
                      {inst.active_plan
                        ? `Every ${inst.active_plan.interval_value} ${inst.active_plan.interval_type.toLowerCase()} (plan v${inst.active_plan.version}, ${inst.active_plan.point_count} point(s))`
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last certificate">
                      {inst.last_event?.certificate_no ?? '—'}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              </div>
            ),
          },
          {
            key: 'plan',
            label: `Plan${inst.active_plan ? ` (v${inst.active_plan.version})` : ''}`,
            children: <PlanEditor instrumentId={inst.id} plans={plans?.data ?? []} />,
          },
          {
            key: 'history',
            label: `History (${history?.events.length ?? 0})`,
            children: (
              <Table
                size="small"
                rowKey={(r) => String((r as { id: string }).id)}
                dataSource={history?.events ?? []}
                pagination={{ pageSize: 15, showSizeChanger: false }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No calibrations yet" /> }}
                onRow={(r) => ({
                  onClick: () => nav(`/calibration/events/${(r as { id: string }).id}`),
                  style: { cursor: 'pointer' },
                })}
                columns={[
                  { title: 'Record', dataIndex: 'event_no', width: 150, render: (v: string) => <span className="font-mono text-xs text-blue-600">{v}</span> },
                  { title: 'Type', dataIndex: 'type', width: 120, render: (v: string) => <span className="text-xs">{v}</span> },
                  { title: 'Performed', width: 120, render: (_: unknown, r) => <span className="text-xs">{fmtDate((r as { performed_at: string | null }).performed_at)}</span> },
                  {
                    title: 'As-found',
                    width: 100,
                    render: (_: unknown, r) => <OutcomeTag v={(r as { as_found_outcome: Outcome | null }).as_found_outcome} />,
                  },
                  {
                    title: 'Overall',
                    width: 110,
                    render: (_: unknown, r) => <OutcomeTag v={(r as { overall_outcome: Outcome | null }).overall_outcome} />,
                  },
                  {
                    title: 'Status',
                    width: 140,
                    render: (_: unknown, r) => {
                      const st = (r as { status: EventStatus }).status;
                      const b = EVENT_STATUS_BADGE[st];
                      return <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded border ${b.cls}`}>{b.label}</span>;
                    },
                  },
                  { title: 'Certificate', dataIndex: 'certificate_no', ellipsis: true, render: (v: string | null) => <span className="text-xs">{v ?? '—'}</span> },
                ]}
              />
            ),
          },
          {
            key: 'checks',
            label: `In-use checks (${history?.checks.length ?? 0})`,
            children: (
              <Table
                size="small"
                rowKey={(r) => String((r as { id: string }).id)}
                dataSource={history?.checks ?? []}
                pagination={{ pageSize: 15, showSizeChanger: false }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No checks recorded" /> }}
                columns={[
                  { title: 'When', width: 170, render: (_: unknown, r) => <span className="text-xs">{fmtDateTime((r as { performed_at: string }).performed_at)}</span> },
                  { title: 'Shift', dataIndex: 'shift', width: 70, render: (v: string | null) => <span className="text-xs">{v ?? '—'}</span> },
                  { title: 'Outcome', width: 100, render: (_: unknown, r) => <OutcomeTag v={(r as { outcome: Outcome }).outcome} /> },
                  { title: 'Batch', dataIndex: 'batch_ref', width: 130, render: (v: string | null) => <span className="text-xs font-mono">{v ?? '—'}</span> },
                  {
                    title: 'Hold',
                    render: (_: unknown, r) =>
                      (r as { hold_triggered: boolean }).hold_triggered ? (
                        <Tag color="red" className="!text-[10px]">hold raised</Tag>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'drift',
            label: 'Drift',
            children: (
              <div>
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                  <TrendingUp size={13} />
                  As-found error per calibration point over time — the evidence behind an interval justification.
                </p>
                {(drift?.series.length ?? 0) === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No approved calibrations yet — drift needs at least one completed record"
                  />
                ) : (
                  <Table
                    size="small"
                    rowKey="label"
                    pagination={false}
                    dataSource={drift!.series}
                    columns={[
                      { title: 'Calibration point', dataIndex: 'label', ellipsis: true },
                      { title: 'Readings', width: 90, align: 'right' as const, render: (_: unknown, r) => r.points.length },
                      {
                        title: 'Max |error|',
                        width: 120,
                        align: 'right' as const,
                        render: (_: unknown, r) => (r.max_abs_error === null ? '—' : <span className="font-mono text-xs">{r.max_abs_error}</span>),
                      },
                      {
                        title: 'Drift / day',
                        width: 130,
                        align: 'right' as const,
                        render: (_: unknown, r) =>
                          r.slope_per_day === null ? (
                            <span className="text-gray-400 text-xs">needs 2+ points</span>
                          ) : (
                            <span className={`font-mono text-xs ${Math.abs(r.slope_per_day) > 0 ? 'text-amber-700' : ''}`}>
                              {r.slope_per_day.toExponential(2)}
                            </span>
                          ),
                      },
                    ]}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      <LabelModal open={labelOpen} onClose={() => setLabelOpen(false)} instrumentId={inst.id} />
    </PageContainer>
  );
}

function OutcomeTag({ v }: { v: Outcome | null }) {
  if (!v) return <span className="text-xs text-gray-400">—</span>;
  return <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded border ${OUTCOME_BADGE[v]}`}>{v}</span>;
}

function LabelModal({ open, onClose, instrumentId }: { open: boolean; onClose: () => void; instrumentId: string }) {
  const { data } = useInstrumentLabel(open ? instrumentId : undefined);
  const url = data ? `${window.location.origin}${data.verify_path}` : '';

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Calibration label" centered width={380}>
      {!data ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : (
        <div className="border-2 border-gray-800 rounded-lg p-4 text-center space-y-1.5 print:border-black">
          <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Calibration status</div>
          <div className={`inline-flex px-3 py-1 text-sm font-bold rounded border ${STATUS_BADGE[data.calibration_status].cls}`}>
            {STATUS_BADGE[data.calibration_status].label}
          </div>
          <div className="font-mono text-lg font-bold pt-1">{data.code}</div>
          <div className="text-xs text-gray-700">{data.name}</div>
          {data.serial_no && <div className="text-[11px] text-gray-500">S/N {data.serial_no}</div>}
          <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] border-t border-gray-200 mt-2">
            <div>
              <div className="text-gray-400">Calibrated</div>
              <div className="font-semibold">{fmtDate(data.last_calibrated_at)}</div>
            </div>
            <div>
              <div className="text-gray-400">Due</div>
              <div className="font-semibold">{fmtDate(data.calibration_due_at)}</div>
            </div>
          </div>
          {data.certificate_no && <div className="text-[10px] text-gray-500 pt-1">Cert. {data.certificate_no}</div>}
          <div className="pt-2 text-[9px] text-gray-400 break-all">{url}</div>
        </div>
      )}
    </Modal>
  );
}
