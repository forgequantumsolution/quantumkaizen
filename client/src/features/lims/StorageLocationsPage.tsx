import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Select, Space, Switch, Table } from 'antd';
import { Snowflake, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { ActiveBadge } from '@/components/ui';
import { useHasPermission } from '@/stores/authStore';
import {
  useStorageLocations, useCreateStorage, useUpdateStorage, useDeleteStorage,
  type StorageLocation, type StorageUpsert,
} from '@/lib/api/samples';

const TYPES = ['Freezer', 'Fridge', 'Ambient', 'Cabinet', 'Cold Room'];

export default function StorageLocationsPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('storage.create');
  const canUpdate = useHasPermission('storage.update');
  const canDelete = useHasPermission('storage.delete');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useStorageLocations({ search: search || undefined });
  const rows = data?.data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StorageLocation | null>(null);
  const deleteMut = useDeleteStorage();

  const onDelete = (r: StorageLocation) =>
    modal.confirm({ title: `Remove ${r.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(r.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Snowflake size={22} className="text-gray-500" />Storage Locations</h1>
          <p className="text-xs text-gray-500 mt-0.5">Freezers, fridges and zones where samples and aliquots are stored.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 240 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Location</Button>}
        </div>
      </div>
      <Table<StorageLocation> size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', width: 220, ellipsis: true },
          { title: 'Type', dataIndex: 'type', width: 120, render: (v: string | null) => v ?? '—' },
          { title: 'Temp Zone', dataIndex: 'temp_zone', width: 110, render: (v: string | null) => v ?? '—' },
          { title: 'Location', dataIndex: 'location', width: 200, ellipsis: true, render: (v: string | null) => v ?? '—' },
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
      <StorageDrawer open={open} onClose={() => setOpen(false)} loc={editing} />
    </PageContainer>
  );
}

function StorageDrawer({ open, onClose, loc }: { open: boolean; onClose: () => void; loc: StorageLocation | null }) {
  const { message } = App.useApp();
  const createMut = useCreateStorage();
  const updateMut = useUpdateStorage(loc?.id ?? '');
  const [form, setForm] = useState<StorageUpsert>({ name: '' });
  useEffect(() => { if (open) setForm(loc ? { name: loc.name, type: loc.type, temp_zone: loc.temp_zone, location: loc.location, is_active: loc.is_active } : { name: '', is_active: true }); }, [open, loc]);
  const set = <K extends keyof StorageUpsert>(k: K, v: StorageUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try { if (loc) { await updateMut.mutateAsync(form); message.success('Updated'); } else { await createMut.mutateAsync(form); message.success('Added'); } onClose(); }
    catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };
  return (
    <Drawer title={loc ? `Edit ${loc.code}` : 'New Storage Location'} open={open} onClose={onClose} width={400} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{loc ? 'Save' : 'Add'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Stability Chamber 1" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Type"><Select value={form.type ?? undefined} onChange={(v) => set('type', v)} allowClear className="w-full" options={TYPES.map((t) => ({ value: t, label: t }))} /></F>
          <F label="Temp Zone"><Input value={form.temp_zone ?? ''} onChange={(e) => set('temp_zone', e.target.value)} placeholder="2-8°C" /></F>
        </div>
        <F label="Location"><Input value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} /></F>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
