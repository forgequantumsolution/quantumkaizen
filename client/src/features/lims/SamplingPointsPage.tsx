import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Space, Switch, Table } from 'antd';
import { MapPin, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useSamplingPoints, useCreateSamplingPoint, useUpdateSamplingPoint, useDeleteSamplingPoint,
  type SamplingPoint, type SamplingPointUpsert,
} from '@/lib/api/samplingPoint';

export default function SamplingPointsPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('sampling_point.create');
  const canUpdate = useHasPermission('sampling_point.update');
  const canDelete = useHasPermission('sampling_point.delete');

  const [search, setSearch] = useState('');
  const { data, isLoading } = useSamplingPoints({ search: search || undefined });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SamplingPoint | null>(null);
  const deleteMut = useDeleteSamplingPoint();

  const onDelete = (s: SamplingPoint) =>
    modal.confirm({ title: `Remove ${s.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(s.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><MapPin size={22} className="text-gray-500" />Sampling Points</h1>
          <p className="text-xs text-gray-500 mt-0.5">Locations where samples are drawn for testing.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name / area…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Sampling Point</Button>}
        </div>
      </div>

      <Table<SamplingPoint>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          { title: 'Area', dataIndex: 'area', width: 160, render: (v: string | null) => v ?? '—' },
          { title: 'Description', dataIndex: 'description', ellipsis: true, render: (v: string | null) => v ?? '—' },
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
      <SamplingPointDrawer open={open} onClose={() => setOpen(false)} point={editing} />
    </PageContainer>
  );
}

function SamplingPointDrawer({ open, onClose, point }: { open: boolean; onClose: () => void; point: SamplingPoint | null }) {
  const { message } = App.useApp();
  const createMut = useCreateSamplingPoint();
  const updateMut = useUpdateSamplingPoint(point?.id ?? '');
  const [form, setForm] = useState<SamplingPointUpsert>({ name: '' });

  useEffect(() => {
    if (open) setForm(point ? {
      name: point.name, area: point.area, description: point.description, is_active: point.is_active,
    } : { name: '', is_active: true });
  }, [open, point]);

  const set = <K extends keyof SamplingPointUpsert>(k: K, v: SamplingPointUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (point) { await updateMut.mutateAsync(form); message.success('Updated'); }
      else { await createMut.mutateAsync(form); message.success('Created'); }
      onClose();
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };

  return (
    <Drawer title={point ? `Edit ${point.code}` : 'New Sampling Point'} open={open} onClose={onClose} width={440} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{point ? 'Save' : 'Create'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Inlet Tank A" /></F>
        <F label="Area"><Input value={form.area ?? ''} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Production Block 1" /></F>
        <F label="Description"><Input.TextArea rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></F>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
