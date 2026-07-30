import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Descriptions, Empty, Input, Select, Space, Spin, Table, Tabs, Tag } from 'antd';
import { AlertTriangle, ArrowLeft, RefreshCw, Send, ShieldCheck, GitBranch, Bell, PackageX } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useOotList,
  useOot,
  useScanImpact,
  useUpdateOot,
  useOotAction,
  useCapabilities,
  OUTCOME_BADGE,
  CRITICALITY_BADGE,
  fmtDate,
  fmtDateTime,
  type Oot,
  type OotStatus,
  type OotDisposition,
} from '@/lib/api/calibration';

const OOT_BADGE: Record<OotStatus, { cls: string; label: string }> = {
  OPEN: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Open' },
  IMPACT_IN_PROGRESS: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Impact in progress' },
  PENDING_QA_APPROVAL: { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Pending QA approval' },
  CLOSED: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Closed' },
};

const DISPOSITIONS: { value: OotDisposition; label: string }[] = [
  { value: 'NO_IMPACT', label: 'No impact' },
  { value: 'IMPACT_CONFIRMED', label: 'Impact confirmed' },
  { value: 'INCONCLUSIVE', label: 'Inconclusive' },
];

export function OotListPage() {
  const nav = useNavigate();
  const [status, setStatus] = useState<OotStatus | undefined>();
  const { data, isLoading } = useOotList({ status });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={22} className="text-gray-500" />
            Out of Tolerance
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Retrospective impact of an as-found failure — every record the instrument touched since it last passed.
          </p>
        </div>
        <Select
          allowClear
          placeholder="Status"
          value={status}
          onChange={setStatus}
          style={{ width: 200 }}
          options={Object.entries(OOT_BADGE).map(([k, v]) => ({ value: k, label: v.label }))}
        />
      </div>

      <Table<Oot>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        pagination={{ pageSize: 25, showSizeChanger: false }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No out-of-tolerance assessments" /> }}
        onRow={(r) => ({ onClick: () => nav(`/calibration/oot/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Record', dataIndex: 'event_no', width: 155, render: (v: string) => <span className="font-mono text-xs text-blue-600">{v}</span> },
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
          {
            title: 'Criticality',
            width: 95,
            render: (_: unknown, r) =>
              r.instrument_criticality ? (
                <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded border ${CRITICALITY_BADGE[r.instrument_criticality]}`}>
                  {r.instrument_criticality}
                </span>
              ) : (
                '—'
              ),
          },
          {
            title: 'Window',
            width: 190,
            render: (_: unknown, r) => (
              <span className="text-[11px] text-gray-600">
                {fmtDate(r.impact_window_from)} → {fmtDate(r.impact_window_to)}
                <span className="text-gray-400 ml-1">({r.impact_window_days}d)</span>
              </span>
            ),
          },
          {
            title: 'Affected',
            width: 85,
            align: 'right' as const,
            render: (_: unknown, r) => (
              <span className={`font-semibold text-xs ${r.affected_total > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                {r.affected_total}
              </span>
            ),
          },
          {
            title: 'Disposition',
            width: 130,
            render: (_: unknown, r) =>
              r.disposition ? (
                <Tag color={r.disposition === 'IMPACT_CONFIRMED' ? 'red' : r.disposition === 'NO_IMPACT' ? 'green' : 'orange'} className="!text-[10px]">
                  {DISPOSITIONS.find((d) => d.value === r.disposition)?.label}
                </Tag>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              ),
          },
          {
            title: 'Status',
            width: 160,
            render: (_: unknown, r) => {
              const b = OOT_BADGE[r.status];
              return <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border ${b.cls}`}>{b.label}</span>;
            },
          },
        ]}
      />
    </PageContainer>
  );
}

export function OotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { modal, message } = App.useApp();

  const { data: oot, isLoading } = useOot(id);
  const { data: caps } = useCapabilities();

  const canUpdate = useHasPermission('calibration_oot.update');
  const canApprove = useHasPermission('calibration_oot.approve');
  const canNotify = useHasPermission('calibration_oot.notify');

  const scan = useScanImpact();
  const update = useUpdateOot();
  const submit = useOotAction('submit');
  const approve = useOotAction('approve');
  const spawn = useOotAction('spawn');
  const notify = useOotAction('notify-customer');
  const hold = useOotAction('product-hold');

  const [disposition, setDisposition] = useState<OotDisposition | undefined>();
  const [justification, setJustification] = useState('');

  if (isLoading || !oot) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const badge = OOT_BADGE[oot.status];
  const closed = oot.status === 'CLOSED';

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  const saveAssessment = () =>
    act(
      () =>
        update.mutateAsync({
          id: oot.id,
          body: { disposition: disposition ?? oot.disposition, justification: justification || oot.justification },
        }),
      'Assessment saved',
    );

  const promptRef = (title: string, placeholder: string, run: (ref: string) => Promise<unknown>) => {
    let ref = '';
    modal.confirm({
      title,
      centered: true,
      content: <Input placeholder={placeholder} onChange={(e) => (ref = e.target.value)} />,
      onOk: async () => {
        if (!ref.trim()) {
          message.warning('A reference is required');
          throw new Error('ref');
        }
        await act(() => run(ref), 'Recorded');
      },
    });
  };

  return (
    <PageContainer>
      <Button type="text" icon={<ArrowLeft size={14} />} onClick={() => nav('/calibration/oot')} className="!px-0 mb-2">
        Out of Tolerance
      </Button>

      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={22} className="text-gray-500" />
              Impact assessment
            </h1>
            <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border ${badge.cls}`}>{badge.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            From{' '}
            <a className="font-mono text-blue-600" onClick={() => nav(`/calibration/events/${oot.event_id}`)}>
              {oot.event_no}
            </a>{' '}
            · {oot.instrument_code} — {oot.instrument_name}
            {oot.as_found_outcome && (
              <span className={`ml-2 inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border ${OUTCOME_BADGE[oot.as_found_outcome]}`}>
                as-found {oot.as_found_outcome}
              </span>
            )}
          </p>
        </div>

        <Space wrap>
          {canUpdate && !closed && (
            <Button icon={<RefreshCw size={14} />} loading={scan.isPending} onClick={() => act(() => scan.mutateAsync(oot.id), 'Impact rescanned')}>
              Re-scan impact
            </Button>
          )}
          {canUpdate && !closed && oot.status !== 'PENDING_QA_APPROVAL' && (
            <Button type="primary" icon={<Send size={14} />} onClick={() => act(() => submit.mutateAsync({ id: oot.id }), 'Submitted for QA approval')}>
              Submit for approval
            </Button>
          )}
          {canApprove && oot.status === 'PENDING_QA_APPROVAL' && (
            <Button type="primary" icon={<ShieldCheck size={14} />} onClick={() => act(() => approve.mutateAsync({ id: oot.id }), 'Assessment closed')}>
              QA approve &amp; close
            </Button>
          )}
        </Space>
      </div>

      {!oot.lims_linked && (
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message="This instrument is not linked to a LIMS equipment record"
          description="The impact scan covers batch references captured on in-use checks. Link the instrument on its detail page to also scan LIMS results."
        />
      )}
      {oot.customer_notification_required && !oot.customer_notified_at && (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="Customer notification required"
          description="IATF 16949 §7.1.5.2.1 — suspect product may already have shipped. Confirmed impact cannot be approved until notification is recorded."
          action={
            canNotify && (
              <Button size="small" icon={<Bell size={12} />} onClick={() => promptRef('Record customer notification', 'Notification reference', (r) => notify.mutateAsync({ id: oot.id, body: { reference: r } }))}>
                Record
              </Button>
            )
          }
        />
      )}
      {oot.product_hold_required && !oot.product_hold_ref && (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="Product hold required"
          description="Product produced inside the impact window must be placed on hold before this assessment can be approved."
          action={
            canNotify && (
              <Button size="small" icon={<PackageX size={12} />} onClick={() => promptRef('Record product hold', 'Hold reference', (r) => hold.mutateAsync({ id: oot.id, body: { reference: r } }))}>
                Record
              </Button>
            )
          }
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Descriptions bordered size="small" column={1} title="Window under suspicion" className="lg:col-span-2">
          <Descriptions.Item label="From">{fmtDateTime(oot.impact_window_from)}</Descriptions.Item>
          <Descriptions.Item label="To">{fmtDateTime(oot.impact_window_to)}</Descriptions.Item>
          <Descriptions.Item label="Duration">{oot.impact_window_days} day(s)</Descriptions.Item>
          <Descriptions.Item label="Worst as-found error">
            {oot.max_observed_error === null ? '—' : <span className="font-mono font-semibold">{oot.max_observed_error}</span>}
          </Descriptions.Item>
          <Descriptions.Item label="Last scanned">{fmtDateTime(oot.last_scanned_at)}</Descriptions.Item>
        </Descriptions>

        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Records in scope</h3>
          <div className="grid grid-cols-2 gap-3">
            <Count label="LIMS results" v={oot.affected_result_ids.length} />
            <Count label="QC results" v={oot.affected_qc_result_ids.length} />
            <Count label="Samples" v={oot.affected_sample_ids.length} />
            <Count label="Batch refs" v={oot.affected_batch_refs.length} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4 mb-4">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Disposition</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Decision</label>
            <Select
              disabled={closed || !canUpdate}
              className="w-full"
              value={disposition ?? oot.disposition ?? undefined}
              onChange={setDisposition}
              options={DISPOSITIONS}
              placeholder="Select…"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Justification</label>
            <Input.TextArea
              disabled={closed || !canUpdate}
              rows={2}
              value={justification || oot.justification || ''}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why is the product / data affected, or not?"
            />
          </div>
        </div>
        {canUpdate && !closed && (
          <Button onClick={saveAssessment} loading={update.isPending}>
            Save assessment
          </Button>
        )}
        {closed && oot.qa_comments && <Alert type="success" className="mt-3" message="QA comments" description={oot.qa_comments} />}
      </div>

      {/* Hand-off actions — only offered when the peer module is actually there. */}
      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4 mb-4">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Hand off</h3>
        <p className="text-[11px] text-gray-500 mb-3">
          Raise a follow-up in another module. Options absent from this deployment are not shown.
        </p>
        <Space wrap>
          {caps?.integrations.deviation?.available && (
            <Button
              icon={<GitBranch size={13} />}
              disabled={!!oot.deviation_ticket_id || !canUpdate}
              onClick={() => act(() => spawn.mutateAsync({ id: oot.id, body: { kind: 'DEVIATION' } }), 'Deviation raised')}
            >
              {oot.deviation_ticket_id ? 'Deviation raised' : 'Raise Deviation'}
            </Button>
          )}
          {caps?.integrations.capa?.available && (
            <Button
              icon={<GitBranch size={13} />}
              disabled={!!oot.capa_ticket_id || !canUpdate}
              onClick={() => act(() => spawn.mutateAsync({ id: oot.id, body: { kind: 'CAPA' } }), 'CAPA raised')}
            >
              {oot.capa_ticket_id ? 'CAPA raised' : 'Raise CAPA'}
            </Button>
          )}
          {caps?.integrations.risk?.available && (
            <Button
              icon={<GitBranch size={13} />}
              disabled={!!oot.risk_id || !canUpdate}
              onClick={() => act(() => spawn.mutateAsync({ id: oot.id, body: { kind: 'RISK' } }), 'Risk raised')}
            >
              {oot.risk_id ? 'Risk raised' : 'Raise Risk'}
            </Button>
          )}
          {!caps?.integrations.deviation?.available && !caps?.integrations.capa?.available && !caps?.integrations.risk?.available && (
            <span className="text-xs text-gray-400">No hand-off targets configured in this deployment.</span>
          )}
        </Space>
      </div>

      <Tabs
        items={[
          {
            key: 'batches',
            label: `Batch references (${oot.affected_batch_refs.length})`,
            children:
              oot.affected_batch_refs.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No batch references in scope" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {oot.affected_batch_refs.map((b) => (
                    <Tag key={b} className="!font-mono !text-[11px]">
                      {b}
                    </Tag>
                  ))}
                </div>
              ),
          },
          {
            key: 'results',
            label: `LIMS results (${oot.affected_results.length})`,
            children: (
              <Table
                size="small"
                rowKey="id"
                dataSource={oot.affected_results}
                pagination={{ pageSize: 15, showSizeChanger: false }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No LIMS results in scope" /> }}
                columns={[
                  { title: 'Sample', dataIndex: 'sample_no', width: 150, render: (v: string | null) => <span className="font-mono text-xs">{v ?? '—'}</span> },
                  { title: 'Analyte', dataIndex: 'analyte', ellipsis: true },
                  { title: 'Value', width: 110, render: (_: unknown, r) => <span className="font-mono text-xs">{r.value ?? '—'} {r.unit ?? ''}</span> },
                  { title: 'Evaluation', dataIndex: 'evaluation', width: 110 },
                  { title: 'Entered', width: 160, render: (_: unknown, r) => <span className="text-xs">{fmtDateTime(r.entered_at)}</span> },
                ]}
              />
            ),
          },
          {
            key: 'samples',
            label: `Samples (${oot.affected_samples.length})`,
            children: (
              <Table
                size="small"
                rowKey="id"
                dataSource={oot.affected_samples}
                pagination={{ pageSize: 15, showSizeChanger: false }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No samples in scope" /> }}
                columns={[
                  { title: 'Sample', dataIndex: 'sample_no', width: 180, render: (v: string) => <span className="font-mono text-xs">{v}</span> },
                  { title: 'Batch', dataIndex: 'batch_no', width: 150, render: (v: string | null) => v ?? '—' },
                  { title: 'Status', dataIndex: 'status' },
                ]}
              />
            ),
          },
        ]}
      />
    </PageContainer>
  );
}

function Count({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className={`text-xl font-bold ${v > 0 ? 'text-amber-700' : 'text-gray-300'}`}>{v}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
    </div>
  );
}
