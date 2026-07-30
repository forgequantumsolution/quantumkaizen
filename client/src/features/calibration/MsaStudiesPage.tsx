import { useState } from 'react';
import { Alert, App, Button, Descriptions, Empty, Input, InputNumber, Modal, Select, Space, Table, Tag } from 'antd';
import { Sigma, Plus, Calculator, ShieldCheck } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useMsaStudies,
  useMsaStudy,
  useCreateMsa,
  useMsaAction,
  useSaveMsaTrials,
  useInstruments,
  fmtDate,
  type MsaStudy,
  type MsaVerdict,
} from '@/lib/api/calibration';

const VERDICT: Record<MsaVerdict, { cls: string; label: string; note: string }> = {
  ACCEPTABLE: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Acceptable', note: '%GRR < 10' },
  CONDITIONAL: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Conditional', note: '%GRR 10–30' },
  UNACCEPTABLE: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Unacceptable', note: '%GRR > 30' },
};

/**
 * MSA / Gage R&R — IATF 16949 §7.1.5.1.1, AIAG average-and-range method.
 * Only reachable when the Automotive pack enables `msa` (see module layout).
 */
export default function MsaStudiesPage() {
  const { data, isLoading } = useMsaStudies();
  const canCreate = useHasPermission('msa_study.create');
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sigma size={22} className="text-gray-500" />
            Measurement Systems Analysis
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Gage R&amp;R by the AIAG average-and-range method. A category flagged <em>requires MSA</em> cannot have an
            active calibration plan until an acceptable study exists.
          </p>
        </div>
        {canCreate && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
            New study
          </Button>
        )}
      </div>

      <Table<MsaStudy>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No MSA studies" /> }}
        onRow={(r) => ({ onClick: () => setDetailId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Study', dataIndex: 'study_no', width: 150, render: (v: string) => <span className="font-mono text-xs text-blue-600">{v}</span> },
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
          { title: 'Type', dataIndex: 'type', width: 155, render: (v: string) => <span className="text-xs">{v.replace(/_/g, ' ')}</span> },
          { title: 'Performed', width: 115, render: (_: unknown, r) => <span className="text-xs">{fmtDate(r.performed_at)}</span> },
          {
            title: 'Design',
            width: 110,
            render: (_: unknown, r) => (
              <span className="text-[11px] text-gray-500">
                {r.part_count}p × {r.operator_count}op × {r.trial_count}t
              </span>
            ),
          },
          { title: 'Trials', dataIndex: 'trial_data_count', width: 70, align: 'right' as const },
          {
            title: '%GRR',
            width: 90,
            align: 'right' as const,
            render: (_: unknown, r) => (r.grr_percent === null ? <span className="text-gray-400 text-xs">—</span> : <span className="font-mono text-xs font-semibold">{r.grr_percent.toFixed(2)}%</span>),
          },
          { title: 'ndc', dataIndex: 'ndc', width: 60, align: 'right' as const, render: (v: number | null) => v ?? '—' },
          {
            title: 'Verdict',
            width: 125,
            render: (_: unknown, r) =>
              r.verdict ? (
                <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded border ${VERDICT[r.verdict].cls}`}>{VERDICT[r.verdict].label}</span>
              ) : (
                <span className="text-xs text-gray-400">not computed</span>
              ),
          },
        ]}
      />

      <NewStudyModal open={open} onClose={() => setOpen(false)} />
      <StudyDetail id={detailId} onClose={() => setDetailId(null)} />
    </PageContainer>
  );
}

function NewStudyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const { data: instruments } = useInstruments({ kind: 'PRODUCTION_GAUGE' });
  const create = useCreateMsa();
  const [form, setForm] = useState<Record<string, unknown>>({ part_count: 10, operator_count: 3, trial_count: 3, type: 'GAGE_RR_CROSSED' });

  const save = async () => {
    if (!form.instrument_id) return message.warning('Select an instrument');
    try {
      await create.mutateAsync(form);
      message.success('Study created — enter trial measurements next');
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  return (
    <Modal open={open} onCancel={onClose} onOk={save} okText="Create" confirmLoading={create.isPending} title="New MSA study" centered>
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Instrument</label>
          <Select
            showSearch
            optionFilterProp="label"
            className="w-full"
            value={form.instrument_id as string | undefined}
            onChange={(v) => setForm((f) => ({ ...f, instrument_id: v }))}
            options={(instruments?.data ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }))}
            placeholder="Select a gauge…"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Study type</label>
          <Select
            className="w-full"
            value={form.type as string}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            options={[
              { value: 'GAGE_RR_CROSSED', label: 'Gage R&R — crossed' },
              { value: 'GAGE_RR_NESTED', label: 'Gage R&R — nested' },
              { value: 'BIAS', label: 'Bias' },
              { value: 'LINEARITY', label: 'Linearity' },
              { value: 'STABILITY', label: 'Stability' },
              { value: 'ATTRIBUTE_AGREEMENT', label: 'Attribute agreement' },
            ]}
          />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {(['part_count', 'operator_count', 'trial_count'] as const).map((k) => (
            <div key={k}>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">{k.replace('_count', 's')}</label>
              <InputNumber min={1} className="w-full" value={form[k] as number} onChange={(v) => setForm((f) => ({ ...f, [k]: v }))} />
            </div>
          ))}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Tolerance</label>
            <InputNumber className="w-full" value={form.tolerance_used as number} onChange={(v) => setForm((f) => ({ ...f, tolerance_used: v }))} />
          </div>
        </div>
        <p className="text-[10px] text-gray-400">
          %GRR is expressed against the tolerance when one is given — a gauge is judged against what it must
          discriminate — and against total variation otherwise.
        </p>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Notes</label>
          <Input.TextArea rows={2} value={form.notes as string} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
    </Modal>
  );
}

function StudyDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { message } = App.useApp();
  const { data: study } = useMsaStudy(id ?? undefined);
  const compute = useMsaAction('compute');
  const approve = useMsaAction('approve');
  const saveTrials = useSaveMsaTrials();
  const canUpdate = useHasPermission('msa_study.update');
  const canApprove = useHasPermission('msa_study.approve');
  const [paste, setPaste] = useState('');

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  /** Accepts `part,operator,trial,measured` per line — the format a gauge lab exports. */
  const importPaste = async () => {
    if (!study) return;
    const trials = paste
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/[,\t;]/).map((x) => Number(x.trim())))
      .filter((c) => c.length >= 4 && c.every((n) => Number.isFinite(n)))
      .map(([p, o, t, m]) => ({ part_no: p!, operator: o!, trial: t!, measured: m! }));
    if (trials.length === 0) return message.warning('No valid rows — expected: part,operator,trial,measured');
    await act(() => saveTrials.mutateAsync({ id: study.id, trials }), `${trials.length} trial(s) imported`);
    setPaste('');
  };

  return (
    <Modal open={!!id} onCancel={onClose} footer={null} width={720} centered title={study?.study_no ?? 'Study'}>
      {!study ? null : (
        <div className="space-y-4">
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Instrument">{study.instrument_code} — {study.instrument_name}</Descriptions.Item>
            <Descriptions.Item label="Type">{study.type.replace(/_/g, ' ')}</Descriptions.Item>
            <Descriptions.Item label="Design">{study.part_count}p × {study.operator_count}op × {study.trial_count}t</Descriptions.Item>
            <Descriptions.Item label="Trials entered">{study.trial_data_count}</Descriptions.Item>
          </Descriptions>

          {study.verdict && (
            <div className={`rounded-lg border p-3 ${VERDICT[study.verdict].cls}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold">{VERDICT[study.verdict].label}</div>
                  <div className="text-[11px] opacity-80">{VERDICT[study.verdict].note}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono">{study.grr_percent?.toFixed(2)}%</div>
                  <div className="text-[11px] opacity-80">ndc {study.ndc}</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-current/20 text-[11px]">
                <Metric label="EV (repeat.)" v={study.repeatability_ev} />
                <Metric label="AV (reprod.)" v={study.reproducibility_av} />
                <Metric label="GRR" v={study.grr} />
                <Metric label="PV" v={study.part_variation} />
              </div>
            </div>
          )}

          {study.verdict === 'UNACCEPTABLE' && (
            <Alert type="error" showIcon message="This gauge cannot be used for product acceptance" description="%GRR above 30% — the measurement system cannot discriminate the characteristic." />
          )}

          {!study.approved_at && canUpdate && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Import trials <span className="font-normal text-gray-400">— one row per measurement: part,operator,trial,value</span>
              </label>
              <Input.TextArea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'1,1,1,50.12\n1,1,2,50.14\n1,2,1,50.10'} className="!font-mono !text-xs" />
              <Space className="mt-2">
                <Button size="small" onClick={importPaste} loading={saveTrials.isPending}>
                  Import
                </Button>
                <Button size="small" type="primary" icon={<Calculator size={12} />} onClick={() => act(() => compute.mutateAsync(study.id), 'Computed')}>
                  Compute Gage R&amp;R
                </Button>
              </Space>
            </div>
          )}

          {study.verdict && !study.approved_at && canApprove && (
            <Button type="primary" icon={<ShieldCheck size={14} />} onClick={() => act(() => approve.mutateAsync(study.id), 'Study approved')}>
              Approve verdict
            </Button>
          )}
          {study.approved_at && <Tag color="green">Approved {fmtDate(study.approved_at)}</Tag>}
        </div>
      )}
    </Modal>
  );
}

function Metric({ label, v }: { label: string; v: number | null }) {
  return (
    <div>
      <div className="font-mono font-semibold">{v === null ? '—' : v.toFixed(4)}</div>
      <div className="opacity-70">{label}</div>
    </div>
  );
}
