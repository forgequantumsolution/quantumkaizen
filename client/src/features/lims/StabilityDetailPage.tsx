import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { App, Button, DatePicker, Input, Modal, Spin, Table } from 'antd';
import { ArrowLeft, FlaskConical, Thermometer, CalendarClock, Plus, Play, CheckCircle2 } from 'lucide-react';
import type { Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useStabilityStudy, useAddCondition, useActivateStudy, useCompleteStudy, usePullTimepoint,
  STUDY_STATUS_BADGE, PULL_STATUS_BADGE, type Condition, type Pull,
} from '@/lib/api/stability';

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}

export default function StabilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { modal, message } = App.useApp();
  const canUpdate = useHasPermission('stability.update');
  const canExecute = useHasPermission('stability.execute');

  const { data: s, isLoading } = useStabilityStudy(id);
  const activateMut = useActivateStudy(id ?? '');
  const completeMut = useCompleteStudy(id ?? '');
  const pullMut = usePullTimepoint();

  const [condOpen, setCondOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);

  if (isLoading || !s) {
    return <PageContainer><div className="flex items-center justify-center py-32"><Spin /></div></PageContainer>;
  }

  const sortedPulls = [...s.pulls].sort((a, b) => {
    const d = a.scheduled_date.localeCompare(b.scheduled_date);
    return d !== 0 ? d : a.timepoint_months - b.timepoint_months;
  });

  const doActivate = async () => {
    try {
      await activateMut.mutateAsync({ start_date: startDate ? startDate.toISOString() : null });
      message.success('Study activated — pull schedule generated');
      setActivateOpen(false); setStartDate(null);
    } catch (e) { message.error(extractErr(e)); }
  };

  const doComplete = () =>
    modal.confirm({
      title: 'Complete study?', okText: 'Complete', centered: true,
      onOk: async () => { try { await completeMut.mutateAsync(); message.success('Study completed'); } catch (e) { message.error(extractErr(e)); } },
    });

  const doPull = async (pull: Pull) => {
    try {
      const res = await pullMut.mutateAsync(pull.id);
      message.success(`Pulled → ${res.sample_number}`);
    } catch (e) { message.error(extractErr(e)); }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/lims/stability" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={14} /> Back</Link>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{s.code}</span>
          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${STUDY_STATUS_BADGE[s.status]}`}>{s.status}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canUpdate && s.status === 'DRAFT' && <Button type="primary" icon={<Play size={14} />} onClick={() => setActivateOpen(true)} loading={activateMut.isPending}>Activate Study</Button>}
          {canUpdate && s.status === 'ACTIVE' && <Button icon={<CheckCircle2 size={14} />} onClick={doComplete} loading={completeMut.isPending}>Complete</Button>}
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><FlaskConical size={18} className="text-gray-400" />{s.title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Product" value={s.product_name} />
          <Field label="Batch" value={s.batch_no ?? '—'} />
          <Field label="Packaging" value={s.packaging ?? '—'} />
          <Field label="Start Date" value={s.start_date ? new Date(s.start_date).toLocaleDateString() : '—'} />
          <Field label="Timepoints (months)" value={s.timepoints_months} />
        </div>
      </div>

      {/* Conditions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Thermometer size={15} className="text-gray-500" />Conditions ({s.conditions.length})</h3>
          {canUpdate && s.status === 'DRAFT' && <Button size="small" icon={<Plus size={13} />} onClick={() => setCondOpen(true)}>Add Condition</Button>}
        </div>
        <Table<Condition> size="small" rowKey="id" dataSource={s.conditions} pagination={false}
          locale={{ emptyText: 'No conditions defined yet.' }}
          columns={[
            { title: 'Name', dataIndex: 'name' },
            { title: 'Temp Zone', dataIndex: 'temp_zone', width: 160, render: (v: string | null) => v ?? '—' },
            { title: 'Orientation', dataIndex: 'orientation', width: 160, render: (v: string | null) => v ?? '—' },
          ]}
        />
      </div>

      {/* Pull schedule */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-3"><CalendarClock size={15} className="text-gray-500" />Pull Schedule ({s.pulls.length})</h3>
        <Table<Pull> size="small" rowKey="id" dataSource={sortedPulls} pagination={false}
          locale={{ emptyText: s.status === 'DRAFT' ? 'Activate the study to generate the pull schedule.' : 'No pulls scheduled.' }}
          columns={[
            { title: 'Condition', render: (_: unknown, r) => r.condition_name ?? '—' },
            { title: 'Timepoint', dataIndex: 'timepoint_label', width: 130 },
            { title: 'Scheduled', width: 120, render: (_: unknown, r) => new Date(r.scheduled_date).toLocaleDateString() },
            {
              title: 'Status', width: 110,
              render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${PULL_STATUS_BADGE[r.status]}`}>{r.status}</span>,
            },
            {
              title: 'Sample', width: 150,
              render: (_: unknown, r) => (r.sample_id ? <Link to={`/lims/samples/${r.sample_id}`} className="font-mono text-blue-600 hover:underline">View</Link> : '—'),
            },
            {
              title: 'Action', width: 100,
              render: (_: unknown, r) =>
                canExecute && (r.status === 'DUE' || r.status === 'SCHEDULED') ? (
                  <Button size="small" type="primary" loading={pullMut.isPending} onClick={() => doPull(r)}>Pull</Button>
                ) : null,
            },
          ]}
        />
      </div>

      <AddConditionModal open={condOpen} onClose={() => setCondOpen(false)} id={id!} />

      <Modal title="Activate Study" open={activateOpen} onCancel={() => setActivateOpen(false)} onOk={doActivate} okText="Activate" okButtonProps={{ loading: activateMut.isPending }} centered>
        <p className="text-sm text-gray-600 mb-3">Activating generates the timepoint pull schedule across all conditions. Pick a start date or leave blank to use today.</p>
        <F label="Start date"><DatePicker value={startDate ?? undefined} onChange={(d) => setStartDate(d ?? null)} className="w-full" /></F>
      </Modal>
    </PageContainer>
  );
}

function AddConditionModal({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  const { message } = App.useApp();
  const mut = useAddCondition(id);
  const [name, setName] = useState('');
  const [temp, setTemp] = useState('');
  const [orientation, setOrientation] = useState('');
  const submit = async () => {
    if (!name.trim()) return message.error('Name is required');
    try {
      await mut.mutateAsync({ name: name.trim(), temp_zone: temp.trim() || null, orientation: orientation.trim() || null });
      message.success('Condition added');
      onClose(); setName(''); setTemp(''); setOrientation('');
    } catch (e) { message.error(extractErr(e)); }
  };
  return (
    <Modal title="Add Condition" open={open} onCancel={onClose} onOk={submit} okText="Add" okButtonProps={{ loading: mut.isPending }} centered>
      <div className="space-y-3">
        <F label="Name *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Long-term" /></F>
        <F label="Temp zone"><Input value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="25°C / 60% RH" /></F>
        <F label="Orientation"><Input value={orientation} onChange={(e) => setOrientation(e.target.value)} placeholder="Upright / Inverted" /></F>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div><div className="text-sm text-gray-900 mt-0.5">{value}</div></div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
