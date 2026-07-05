import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Select, Space, Switch, Table } from 'antd';
import { Beaker, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useAnalytes, useCreateAnalyte, useUpdateAnalyte, useDeleteAnalyte,
  type Analyte, type AnalyteUpsert, type AnalyteDataType,
} from '@/lib/api/analyte';

const DATA_TYPE_OPTIONS: { value: AnalyteDataType; label: string }[] = [
  { value: 'NUMERIC', label: 'Numeric' },
  { value: 'TEXT', label: 'Text' },
  { value: 'BOOLEAN', label: 'Boolean' },
];

export default function AnalytesPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('analyte.create');
  const canUpdate = useHasPermission('analyte.update');
  const canDelete = useHasPermission('analyte.delete');

  const [search, setSearch] = useState('');
  const { data, isLoading } = useAnalytes({ search: search || undefined });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Analyte | null>(null);
  const deleteMut = useDeleteAnalyte();

  const onDelete = (a: Analyte) =>
    modal.confirm({ title: `Remove ${a.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(a.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Beaker size={22} className="text-gray-500" />Analytes</h1>
          <p className="text-xs text-gray-500 mt-0.5">Measurable quantities referenced by specification parameters and test requests.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name / category…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Analyte</Button>}
        </div>
      </div>

      <Table<Analyte>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          { title: 'Default Unit', dataIndex: 'default_unit', width: 110, render: (v: string | null) => v ?? '—' },
          { title: 'Data Type', dataIndex: 'data_type', width: 110 },
          { title: 'Category', dataIndex: 'category', width: 130, render: (v: string | null) => v ?? '—' },
          { title: 'Active', dataIndex: 'is_active', width: 70, render: (v: boolean) => (v ? 'Yes' : 'No') },
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
      <AnalyteDrawer open={open} onClose={() => setOpen(false)} analyte={editing} />
    </PageContainer>
  );
}

function AnalyteDrawer({ open, onClose, analyte }: { open: boolean; onClose: () => void; analyte: Analyte | null }) {
  const { message } = App.useApp();
  const createMut = useCreateAnalyte();
  const updateMut = useUpdateAnalyte(analyte?.id ?? '');
  const [form, setForm] = useState<AnalyteUpsert>({ name: '', data_type: 'NUMERIC' });

  useEffect(() => {
    if (open) setForm(analyte ? {
      name: analyte.name, default_unit: analyte.default_unit, data_type: analyte.data_type,
      category: analyte.category, is_active: analyte.is_active,
    } : { name: '', data_type: 'NUMERIC', is_active: true });
  }, [open, analyte]);

  const set = <K extends keyof AnalyteUpsert>(k: K, v: AnalyteUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (analyte) { await updateMut.mutateAsync(form); message.success('Updated'); }
      else { await createMut.mutateAsync(form); message.success('Created'); }
      onClose();
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };

  return (
    <Drawer title={analyte ? `Edit ${analyte.code}` : 'New Analyte'} open={open} onClose={onClose} width={440} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{analyte ? 'Save' : 'Create'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Loss on Drying" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Default Unit"><Input value={form.default_unit ?? ''} onChange={(e) => set('default_unit', e.target.value)} placeholder="%, ppm, mg…" /></F>
          <F label="Data Type"><Select className="w-full" value={form.data_type ?? 'NUMERIC'} onChange={(v) => set('data_type', v)} options={DATA_TYPE_OPTIONS} /></F>
        </div>
        <F label="Category"><Input value={form.category ?? ''} onChange={(e) => set('category', e.target.value)} placeholder="Physical, Chemical…" /></F>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
