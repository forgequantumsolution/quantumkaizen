import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Drawer, Input, Select, Space, Table } from 'antd';
import { FlaskConical, Plus, Search, X } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useStabilityStudies, useCreateStudy,
  STUDY_STATUS_BADGE, type StudySummary, type StudyStatus, type StudyUpsert, type ConditionInput,
} from '@/lib/api/stability';

const STATUS_OPTIONS: StudyStatus[] = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
const DEFAULT_TIMEPOINTS = '0,3,6,9,12,18,24';

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}

export default function StabilityListPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('stability.create');
  const [status, setStatus] = useState<StudyStatus | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useStabilityStudies({ status, search: search || undefined });
  const rows = data?.data ?? [];
  const [open, setOpen] = useState(false);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FlaskConical size={22} className="text-gray-500" />Stability Studies</h1>
          <p className="text-xs text-gray-500 mt-0.5">ICH Q1A stability protocols — conditions, timepoints and an auto-generated pull schedule.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={status} onChange={setStatus} allowClear placeholder="All statuses" style={{ width: 160 }}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / title / product / batch…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 280 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>New Study</Button>}
        </div>
      </div>

      <Table<StudySummary>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        onRow={(r) => ({ onClick: () => nav(`/lims/stability/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 130, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Title', dataIndex: 'title', ellipsis: true, width: 300 },
          { title: 'Product', dataIndex: 'product_name', width: 200, ellipsis: true },
          { title: 'Batch', dataIndex: 'batch_no', width: 120, render: (v: string | null) => v ? <span className="font-mono">{v}</span> : '—' },
          {
            title: 'Status', width: 120,
            render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${STUDY_STATUS_BADGE[r.status]}`}>{r.status}</span>,
          },
          { title: 'Pulls', dataIndex: 'pull_count', width: 80, align: 'right' },
          { title: 'Started', width: 110, render: (_: unknown, r) => (r.start_date ? new Date(r.start_date).toLocaleDateString() : '—') },
        ]}
      />

      <CreateDrawer open={open} onClose={() => setOpen(false)} onDone={(id) => { setOpen(false); nav(`/lims/stability/${id}`); }} />
    </PageContainer>
  );
}

function CreateDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const { message } = App.useApp();
  const createMut = useCreateStudy();

  const [f, setF] = useState<StudyUpsert>({ product_name: '', title: '', timepoints_months: DEFAULT_TIMEPOINTS });
  const [conditions, setConditions] = useState<ConditionInput[]>([{ name: '', temp_zone: '' }]);
  const set = <K extends keyof StudyUpsert>(k: K, v: StudyUpsert[K]) => setF((p) => ({ ...p, [k]: v }));

  const setCond = (i: number, patch: Partial<ConditionInput>) => setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCond = () => setConditions((cs) => [...cs, { name: '', temp_zone: '' }]);
  const removeCond = (i: number) => setConditions((cs) => cs.filter((_, idx) => idx !== i));

  const reset = () => { setF({ product_name: '', title: '', timepoints_months: DEFAULT_TIMEPOINTS }); setConditions([{ name: '', temp_zone: '' }]); };

  const submit = async () => {
    if (!f.product_name?.trim()) return message.error('Product name is required');
    if (!f.title?.trim()) return message.error('Title is required');
    const conds = conditions.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), temp_zone: c.temp_zone?.trim() || null }));
    try {
      const created = await createMut.mutateAsync({
        product_name: f.product_name.trim(),
        title: f.title.trim(),
        batch_no: f.batch_no?.trim() || null,
        packaging: f.packaging?.trim() || null,
        timepoints_months: f.timepoints_months?.trim() || DEFAULT_TIMEPOINTS,
        conditions: conds.length ? conds : undefined,
      });
      message.success(`Created ${created.code}`);
      reset();
      onDone(created.id);
    } catch (e) { message.error(extractErr(e)); }
  };

  return (
    <Drawer title="New Stability Study" open={open} onClose={onClose} width={480} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending}>Create</Button></Space>}>
      <div className="space-y-3">
        <F label="Product / Material *"><Input value={f.product_name} onChange={(e) => set('product_name', e.target.value)} /></F>
        <F label="Title *"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Paracetamol 500mg — Long-term + Accelerated" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Batch No."><Input value={f.batch_no ?? ''} onChange={(e) => set('batch_no', e.target.value)} /></F>
          <F label="Packaging"><Input value={f.packaging ?? ''} onChange={(e) => set('packaging', e.target.value)} placeholder="HDPE bottle…" /></F>
        </div>
        <F label="Timepoints (months)"><Input value={f.timepoints_months ?? ''} onChange={(e) => set('timepoints_months', e.target.value)} placeholder={DEFAULT_TIMEPOINTS} /></F>

        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-medium text-gray-600">Conditions</label>
            <Button size="small" icon={<Plus size={13} />} onClick={addCond}>Add</Button>
          </div>
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input size="small" value={c.name} onChange={(e) => setCond(i, { name: e.target.value })} placeholder="Name * (e.g. Long-term)" className="flex-1" />
                <Input size="small" value={c.temp_zone ?? ''} onChange={(e) => setCond(i, { temp_zone: e.target.value })} placeholder="25°C/60%RH" style={{ width: 130 }} />
                <button onClick={() => removeCond(i)} className="text-gray-400 hover:text-red-600"><X size={14} /></button>
              </div>
            ))}
            {conditions.length === 0 && <div className="text-[11px] text-gray-400">No conditions added — you can add them later on the study.</div>}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
