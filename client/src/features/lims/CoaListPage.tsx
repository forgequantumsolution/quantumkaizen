import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Drawer, Input, Modal, Popconfirm, Select, Space, Switch, Table } from 'antd';
import { Award, Plus, Search, FileText, Pencil, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useCoas, useGenerateCoa, useCoaTemplates, useCreateCoaTemplate, useUpdateCoaTemplate, useDeleteCoaTemplate,
  COA_STATUS_BADGE, type Coa, type CoaStatus, type CoaTemplate, type CoaTemplateUpsert,
} from '@/lib/api/coa';
import { useSamples } from '@/lib/api/samples';

const STATUS_OPTIONS: { value: CoaStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' }, { value: 'ISSUED', label: 'Issued' }, { value: 'REVOKED', label: 'Revoked' },
];
const SECTION_OPTIONS = ['description', 'results', 'conclusion', 'signatures'].map((s) => ({ value: s, label: s }));

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}

export default function CoaListPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('coa.create');
  const canManage = useHasPermission('coa.manage');
  const [status, setStatus] = useState<CoaStatus | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCoas({ status, search: search || undefined });
  const rows = data?.data ?? [];
  const [genOpen, setGenOpen] = useState(false);
  const [tmplOpen, setTmplOpen] = useState(false);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Award size={22} className="text-gray-500" />Certificates of Analysis</h1>
          <p className="text-xs text-gray-500 mt-0.5">Generate, issue and verify certificates from released sample results.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<FileText size={14} />} onClick={() => setTmplOpen(true)}>Templates</Button>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => setGenOpen(true)}>Generate CoA</Button>}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mb-3">
        <Select value={status} onChange={setStatus} allowClear placeholder="All statuses" style={{ width: 160 }} options={STATUS_OPTIONS} />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <Input placeholder="Search no. / product / batch…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 280 }} />
        </div>
      </div>

      <Table<Coa>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => nav(`/lims/coa/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'coa_number', width: 170, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Product', dataIndex: 'product_name', ellipsis: true },
          { title: 'Batch', dataIndex: 'batch_no', width: 120, render: (v: string | null) => v ?? '—' },
          {
            title: 'Status', width: 110,
            render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${COA_STATUS_BADGE[r.status]}`}>{r.status}</span>,
          },
          { title: 'Issued', width: 110, render: (_: unknown, r) => (r.issued_at ? new Date(r.issued_at).toLocaleDateString() : '—') },
        ]}
      />

      <GenerateModal open={genOpen} onClose={() => setGenOpen(false)} onDone={(id) => { setGenOpen(false); nav(`/lims/coa/${id}`); }} />
      <TemplatesDrawer open={tmplOpen} onClose={() => setTmplOpen(false)} canManage={canManage} />
    </PageContainer>
  );
}

function GenerateModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const { message } = App.useApp();
  const mut = useGenerateCoa();
  const { data: samples } = useSamples();
  // Certificates are issued off released results; surface released samples first.
  const sampleOpts = [...(samples?.data ?? [])]
    .sort((a, b) => (a.status === 'RELEASED' ? -1 : 0) - (b.status === 'RELEASED' ? -1 : 0))
    .map((s) => ({ value: s.id, label: `${s.sample_number} — ${s.product_name}${s.batch_no ? ` · ${s.batch_no}` : ''} (${s.status})` }));
  const [sampleId, setSampleId] = useState<string | undefined>();
  const [conclusion, setConclusion] = useState('');
  const submit = async () => {
    if (!sampleId) return message.error('Select a sample');
    try {
      const created = await mut.mutateAsync({ sample_id: sampleId, conclusion: conclusion || null });
      message.success(`Generated ${created.coa_number}`);
      setSampleId(undefined); setConclusion('');
      onDone(created.id);
    } catch (e) { message.error(extractErr(e)); }
  };
  return (
    <Modal title="Generate Certificate of Analysis" open={open} onCancel={onClose} onOk={submit} okText="Generate" okButtonProps={{ loading: mut.isPending }} centered destroyOnClose>
      <div className="space-y-3">
        <F label="Sample *">
          <Select value={sampleId} onChange={setSampleId} showSearch optionFilterProp="label" className="w-full" placeholder="Select a tested sample" options={sampleOpts} />
          <p className="text-[11px] text-gray-400 mt-1">Snapshots the sample&apos;s test results into a certificate.</p>
        </F>
        <F label="Conclusion"><Input.TextArea rows={2} value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Optional overall conclusion" /></F>
      </div>
    </Modal>
  );
}

function TemplatesDrawer({ open, onClose, canManage }: { open: boolean; onClose: () => void; canManage: boolean }) {
  const { message } = App.useApp();
  const { data, isLoading } = useCoaTemplates();
  const templates = data?.data ?? [];
  const createMut = useCreateCoaTemplate();
  const deleteMut = useDeleteCoaTemplate();
  const [editing, setEditing] = useState<CoaTemplate | null>(null);
  const [form, setForm] = useState<CoaTemplateUpsert>({ name: '' });
  const set = <K extends keyof CoaTemplateUpsert>(k: K, v: CoaTemplateUpsert[K]) => setForm((p) => ({ ...p, [k]: v }));

  const updateMut = useUpdateCoaTemplate(editing?.id ?? '');

  const startNew = () => { setEditing(null); setForm({ name: '', sections: [] }); };
  const startEdit = (t: CoaTemplate) => {
    setEditing(t);
    setForm({ name: t.name, title: t.title, sections: t.sections, customer_id: t.customer_id, is_active: t.is_active });
  };
  const submit = async () => {
    if (!form.name?.trim()) return message.error('Name is required');
    try {
      if (editing) { await updateMut.mutateAsync(form); message.success('Template updated'); }
      else { await createMut.mutateAsync(form); message.success('Template created'); }
      setEditing(null); setForm({ name: '' });
    } catch (e) { message.error(extractErr(e)); }
  };
  const remove = async (id: string) => {
    try { await deleteMut.mutateAsync(id); message.success('Template deleted'); if (editing?.id === id) { setEditing(null); setForm({ name: '' }); } }
    catch (e) { message.error(extractErr(e)); }
  };

  return (
    <Drawer title="CoA Templates" open={open} onClose={onClose} width={460} destroyOnClose>
      <Table<CoaTemplate>
        size="small" rowKey="id" loading={isLoading} dataSource={templates} pagination={false}
        locale={{ emptyText: 'No templates yet.' }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-xs">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          {
            title: '', width: 70,
            render: (_: unknown, r) => canManage ? (
              <Space size={4}>
                <Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => startEdit(r)} />
                <Popconfirm title="Delete template?" onConfirm={() => remove(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                  <Button type="text" size="small" danger icon={<Trash2 size={13} />} />
                </Popconfirm>
              </Space>
            ) : null,
          },
        ]}
      />

      {canManage && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">{editing ? `Edit: ${editing.code}` : 'New Template'}</h4>
            {editing && <Button size="small" onClick={startNew}>New</Button>}
          </div>
          <div className="space-y-3">
            <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></F>
            <F label="Title"><Input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Document title" /></F>
            <F label="Sections">
              <Select mode="multiple" value={form.sections ?? []} onChange={(v) => set('sections', v)} className="w-full" options={SECTION_OPTIONS} placeholder="Sections to render" />
            </F>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} size="small" />
              <span className="text-xs text-gray-600">Active</span>
            </div>
            <div className="flex justify-end">
              <Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{editing ? 'Save' : 'Create'}</Button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
