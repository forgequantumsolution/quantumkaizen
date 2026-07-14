import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, InputNumber, Space, Switch, Table } from 'antd';
import { Beaker, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { ActiveBadge } from '@/components/ui';
import { useHasPermission } from '@/stores/authStore';
import {
  useMethods, useCreateMethod, useUpdateMethod, useDeleteMethod,
  type TestMethod, type MethodUpsert,
} from '@/lib/api/lims';

export default function MethodsPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('method.create');
  const canUpdate = useHasPermission('method.update');
  const canDelete = useHasPermission('method.delete');

  const [search, setSearch] = useState('');
  const { data, isLoading } = useMethods({ search: search || undefined });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TestMethod | null>(null);
  const deleteMut = useDeleteMethod();

  const onDelete = (m: TestMethod) =>
    modal.confirm({ title: `Remove ${m.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(m.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Beaker size={22} className="text-gray-500" />Test Methods</h1>
          <p className="text-xs text-gray-500 mt-0.5">Analytical methods referenced by specification parameters and test requests.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name / technique…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Method</Button>}
        </div>
      </div>

      <Table<TestMethod>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', width: 240, ellipsis: true },
          { title: 'Technique', dataIndex: 'technique', width: 130, render: (v: string | null) => v ?? '—' },
          { title: 'SOP Ref', dataIndex: 'sop_ref', width: 130, render: (v: string | null) => v ?? '—' },
          { title: 'Unit', dataIndex: 'default_unit', width: 80, render: (v: string | null) => v ?? '—' },
          { title: 'Price', dataIndex: 'price', width: 90, render: (v: number | null) => (v != null ? v : '—') },
          { title: 'Active', dataIndex: 'is_active', width: 90, render: (v: boolean) => <ActiveBadge active={v} /> },
          {
            title: '', width: 90,
            render: (_: unknown, r) => (
              <Space size={4}>
                {canUpdate && <Button size="small" icon={<Edit3 size={12} />} onClick={() => { setEditing(r); setOpen(true); }} />}
                {canDelete && <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => onDelete(r)} />}
              </Space>
            ),
          },
        ]}
      />
      <MethodDrawer open={open} onClose={() => setOpen(false)} method={editing} />
    </PageContainer>
  );
}

function MethodDrawer({ open, onClose, method }: { open: boolean; onClose: () => void; method: TestMethod | null }) {
  const { message } = App.useApp();
  const createMut = useCreateMethod();
  const updateMut = useUpdateMethod(method?.id ?? '');
  const [form, setForm] = useState<MethodUpsert>({ name: '' });

  useEffect(() => {
    if (open) setForm(method ? {
      name: method.name, technique: method.technique, sop_ref: method.sop_ref, document_id: method.document_id,
      description: method.description, default_unit: method.default_unit, price: method.price, is_active: method.is_active,
    } : { name: '', is_active: true });
  }, [open, method]);

  const set = <K extends keyof MethodUpsert>(k: K, v: MethodUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (method) { await updateMut.mutateAsync(form); message.success('Updated'); }
      else { await createMut.mutateAsync(form); message.success('Created'); }
      onClose();
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };

  return (
    <Drawer title={method ? `Edit ${method.code}` : 'New Method'} open={open} onClose={onClose} width={440} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{method ? 'Save' : 'Create'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Assay by HPLC" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Technique"><Input value={form.technique ?? ''} onChange={(e) => set('technique', e.target.value)} placeholder="HPLC, GC…" /></F>
          <F label="Default Unit"><Input value={form.default_unit ?? ''} onChange={(e) => set('default_unit', e.target.value)} placeholder="%, ppm, mg…" /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="SOP Ref"><Input value={form.sop_ref ?? ''} onChange={(e) => set('sop_ref', e.target.value)} /></F>
          <F label="Price"><InputNumber value={form.price ?? undefined} onChange={(v) => set('price', v ?? null)} min={0} className="w-full" /></F>
        </div>
        <F label="Description"><Input.TextArea rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></F>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
