import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Drawer, Input, InputNumber, Space, Switch, Table } from 'antd';
import { Activity, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useQcMaterials, useCreateQcMaterial, useUpdateQcMaterial, useDeleteQcMaterial,
  type QcMaterial, type QcMaterialUpsert,
} from '@/lib/api/qc';

export default function QcMaterialsPage() {
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('qc.create');
  const canUpdate = useHasPermission('qc.update');

  const [search, setSearch] = useState('');
  const { data, isLoading } = useQcMaterials({ search: search || undefined });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QcMaterial | null>(null);
  const deleteMut = useDeleteQcMaterial();

  const onDelete = (m: QcMaterial) =>
    modal.confirm({ title: `Remove ${m.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(m.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  const fmtMeanSd = (r: QcMaterial) => {
    if (r.target_mean == null && r.target_sd == null) return '—';
    return `${r.target_mean ?? '—'} ± ${r.target_sd ?? '—'}`;
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Activity size={22} className="text-gray-500" />Quality Control</h1>
          <p className="text-xs text-gray-500 mt-0.5">Levey-Jennings control charts with Westgard rule evaluation for QC materials.</p>
        </div>
        {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Control Material</Button>}
      </div>

      <div className="flex items-center justify-end mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <Input placeholder="Search code / name / analyte…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
        </div>
      </div>

      <Table<QcMaterial>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        rowClassName="cursor-pointer"
        onRow={(r) => ({ onClick: () => navigate(`/lims/qc/${r.id}`) })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 120, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          { title: 'Analyte', dataIndex: 'analyte_name', width: 150, render: (v: string | null) => v ?? '—' },
          { title: 'Mean ± SD', width: 140, render: (_: unknown, r) => fmtMeanSd(r) },
          { title: '#Results', dataIndex: 'result_count', width: 90, render: (v: number) => v },
          { title: 'Active', dataIndex: 'is_active', width: 70, render: (v: boolean) => (v ? 'Yes' : 'No') },
          {
            title: '', width: 90,
            render: (_: unknown, r) => (
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                {canUpdate && <Button size="small" icon={<Edit3 size={12} />} onClick={() => { setEditing(r); setOpen(true); }} />}
                {canUpdate && <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => onDelete(r)} />}
              </Space>
            ),
          },
        ]}
      />
      <MaterialDrawer open={open} onClose={() => setOpen(false)} material={editing} />
    </PageContainer>
  );
}

function MaterialDrawer({ open, onClose, material }: { open: boolean; onClose: () => void; material: QcMaterial | null }) {
  const { message } = App.useApp();
  const createMut = useCreateQcMaterial();
  const updateMut = useUpdateQcMaterial(material?.id ?? '');
  const [form, setForm] = useState<QcMaterialUpsert>({ name: '' });

  useEffect(() => {
    if (open) setForm(material ? {
      name: material.name, analyte_name: material.analyte_name, lot_no: material.lot_no,
      unit: material.unit, target_mean: material.target_mean, target_sd: material.target_sd, is_active: material.is_active,
    } : { name: '', is_active: true });
  }, [open, material]);

  const set = <K extends keyof QcMaterialUpsert>(k: K, v: QcMaterialUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (material) { await updateMut.mutateAsync(form); message.success('Updated'); }
      else { await createMut.mutateAsync(form); message.success('Created'); }
      onClose();
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };

  return (
    <Drawer title={material ? `Edit ${material.code}` : 'New Control Material'} open={open} onClose={onClose} width={440} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{material ? 'Save' : 'Create'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Level 1 QC Serum" /></F>
        <F label="Analyte"><Input value={form.analyte_name ?? ''} onChange={(e) => set('analyte_name', e.target.value)} placeholder="e.g. Glucose" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Lot No"><Input value={form.lot_no ?? ''} onChange={(e) => set('lot_no', e.target.value)} /></F>
          <F label="Unit"><Input value={form.unit ?? ''} onChange={(e) => set('unit', e.target.value)} placeholder="mg/dL, %…" /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Target Mean"><InputNumber value={form.target_mean ?? undefined} onChange={(v) => set('target_mean', v ?? null)} className="w-full" /></F>
          <F label="Target SD"><InputNumber value={form.target_sd ?? undefined} onChange={(v) => set('target_sd', v ?? null)} min={0} className="w-full" /></F>
        </div>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
