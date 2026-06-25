import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Select, Space, Switch, Table } from 'antd';
import { Ruler, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit,
  type UnitOfMeasure, type UnitUpsert,
} from '@/lib/api/unit';

const KIND_OPTIONS = [
  { value: 'mass', label: 'Mass' },
  { value: 'volume', label: 'Volume' },
  { value: 'concentration', label: 'Concentration' },
  { value: 'count', label: 'Count' },
  { value: 'ratio', label: 'Ratio' },
];

export default function UnitsPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('unit.create');
  const canUpdate = useHasPermission('unit.update');
  const canDelete = useHasPermission('unit.delete');

  const [search, setSearch] = useState('');
  const { data, isLoading } = useUnits({ search: search || undefined });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UnitOfMeasure | null>(null);
  const deleteMut = useDeleteUnit();

  const onDelete = (u: UnitOfMeasure) =>
    modal.confirm({ title: `Remove ${u.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(u.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Ruler size={22} className="text-gray-500" />Units of Measure</h1>
          <p className="text-xs text-gray-500 mt-0.5">Standard units referenced by specification parameters and test results.</p>
        </div>
        {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Unit</Button>}
      </div>

      <div className="flex items-center justify-end mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <Input placeholder="Search code / name / symbol…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
        </div>
      </div>

      <Table<UnitOfMeasure>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          { title: 'Symbol', dataIndex: 'symbol', width: 110, render: (v: string | null) => v ?? '—' },
          { title: 'Kind', dataIndex: 'kind', width: 140, render: (v: string | null) => v ?? '—' },
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
      <UnitDrawer open={open} onClose={() => setOpen(false)} unit={editing} />
    </PageContainer>
  );
}

function UnitDrawer({ open, onClose, unit }: { open: boolean; onClose: () => void; unit: UnitOfMeasure | null }) {
  const { message } = App.useApp();
  const createMut = useCreateUnit();
  const updateMut = useUpdateUnit(unit?.id ?? '');
  const [form, setForm] = useState<UnitUpsert>({ name: '' });

  useEffect(() => {
    if (open) setForm(unit ? {
      name: unit.name, symbol: unit.symbol, kind: unit.kind, is_active: unit.is_active,
    } : { name: '', is_active: true });
  }, [open, unit]);

  const set = <K extends keyof UnitUpsert>(k: K, v: UnitUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (unit) { await updateMut.mutateAsync(form); message.success('Updated'); }
      else { await createMut.mutateAsync(form); message.success('Created'); }
      onClose();
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };

  return (
    <Drawer title={unit ? `Edit ${unit.code}` : 'New Unit'} open={open} onClose={onClose} width={440} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{unit ? 'Save' : 'Create'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Milligram" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Symbol"><Input value={form.symbol ?? ''} onChange={(e) => set('symbol', e.target.value)} placeholder="mg, mL, %…" /></F>
          <F label="Kind"><Select value={form.kind ?? undefined} onChange={(v) => set('kind', v ?? null)} allowClear placeholder="Select kind" className="w-full" options={KIND_OPTIONS} /></F>
        </div>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
