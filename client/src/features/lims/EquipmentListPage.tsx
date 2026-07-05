import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Drawer, Input, InputNumber, Select, Space, Table } from 'antd';
import { Gauge, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useEquipment,
  useCreateEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
  useLabs,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentSummary,
  type EquipmentStatus,
  type EquipmentUpsert,
} from '@/lib/api/lims';

const STATUS_OPTIONS = Object.entries(EQUIPMENT_STATUS_LABELS).map(([v, label]) => ({ value: v, label }));
const STATUS_BADGE: Record<EquipmentStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OUT_OF_SERVICE: 'bg-red-50 text-red-700 border-red-200',
  RETIRED: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function EquipmentListPage() {
  const nav = useNavigate();
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('equipment.create');
  const canUpdate = useHasPermission('equipment.update');
  const canDelete = useHasPermission('equipment.delete');

  const [status, setStatus] = useState<EquipmentStatus | undefined>();
  const [dueOnly, setDueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useEquipment({ status, calibration_due: dueOnly || undefined, search: search || undefined });
  const rows = data?.data ?? [];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentSummary | null>(null);
  const deleteMut = useDeleteEquipment();

  const onDelete = (e: EquipmentSummary) =>
    modal.confirm({
      title: `Remove ${e.code}?`,
      okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(e.id); message.success('Removed'); } catch { message.error('Failed'); } },
    });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gauge size={22} className="text-gray-500" />
            Equipment &amp; Calibration
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Instruments with calibration schedules — overdue items are flagged not-for-use.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button type={dueOnly ? 'primary' : 'default'} size="middle" onClick={() => setDueOnly((v) => !v)}>Calibration due</Button>
          <Select value={status} onChange={setStatus} allowClear placeholder="All statuses" style={{ width: 160 }} options={STATUS_OPTIONS} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name / serial…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
          </div>
          {canCreate && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setDrawerOpen(true); }}>
              New Equipment
            </Button>
          )}
        </div>
      </div>

      <Table<EquipmentSummary>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => nav(`/lims/equipment/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          { title: 'Category', dataIndex: 'category', width: 120, render: (v: string | null) => v ?? '—' },
          { title: 'Lab', width: 140, render: (_: unknown, r) => r.lab_name ?? '—' },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 130,
            render: (v: EquipmentStatus) => (
              <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${STATUS_BADGE[v]}`}>{EQUIPMENT_STATUS_LABELS[v]}</span>
            ),
          },
          {
            title: 'Calibration Due',
            width: 150,
            render: (_: unknown, r) =>
              r.calibration_due_at ? (
                <span className="flex items-center gap-1.5">
                  {new Date(r.calibration_due_at).toLocaleDateString()}
                  {r.calibration_overdue && <span className="text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Overdue</span>}
                </span>
              ) : '—',
          },
          {
            title: '',
            width: 90,
            render: (_: unknown, r) => (
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                {canUpdate && <Button size="small" icon={<Edit3 size={12} />} onClick={() => { setEditing(r); setDrawerOpen(true); }} />}
                {canDelete && <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => onDelete(r)} />}
              </Space>
            ),
          },
        ]}
      />

      <EquipmentDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} equipment={editing} />
    </PageContainer>
  );
}

function EquipmentDrawer({ open, onClose, equipment }: { open: boolean; onClose: () => void; equipment: EquipmentSummary | null }) {
  const { message } = App.useApp();
  const createMut = useCreateEquipment();
  const updateMut = useUpdateEquipment(equipment?.id ?? '');
  const { data: labsData } = useLabs({ is_active: true });
  const labs = labsData?.data ?? [];

  const [form, setForm] = useState<EquipmentUpsert>({ name: '' });

  useEffect(() => {
    if (open) {
      setForm(
        equipment
          ? {
              name: equipment.name, category: equipment.category, lab_id: equipment.lab_id, serial_no: equipment.serial_no,
              manufacturer: equipment.manufacturer, model: equipment.model, location: equipment.location, status: equipment.status,
              calibration_frequency_days: equipment.calibration_frequency_days,
            }
          : { name: '', status: 'ACTIVE' },
      );
    }
  }, [open, equipment]);

  const set = <K extends keyof EquipmentUpsert>(k: K, v: EquipmentUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (equipment) { await updateMut.mutateAsync(form); message.success('Updated'); }
      else { await createMut.mutateAsync(form); message.success('Registered'); }
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed');
    }
  };

  return (
    <Drawer
      title={equipment ? `Edit ${equipment.code}` : 'New Equipment'}
      open={open}
      onClose={onClose}
      width={460}
      destroyOnClose
      footer={
        <Space className="flex justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{equipment ? 'Save' : 'Register'}</Button>
        </Space>
      }
    >
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. HPLC System 1" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Category"><Input value={form.category ?? ''} onChange={(e) => set('category', e.target.value)} placeholder="HPLC, Balance…" /></F>
          <F label="Status"><Select value={form.status ?? 'ACTIVE'} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} className="w-full" /></F>
        </div>
        <F label="Lab"><Select value={form.lab_id ?? undefined} onChange={(v) => set('lab_id', v ?? null)} allowClear showSearch optionFilterProp="label" placeholder="Assign to a lab" className="w-full" options={labs.map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))} /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Serial No."><Input value={form.serial_no ?? ''} onChange={(e) => set('serial_no', e.target.value)} /></F>
          <F label="Location"><Input value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Manufacturer"><Input value={form.manufacturer ?? ''} onChange={(e) => set('manufacturer', e.target.value)} /></F>
          <F label="Model"><Input value={form.model ?? ''} onChange={(e) => set('model', e.target.value)} /></F>
        </div>
        <F label="Calibration frequency (days)">
          <InputNumber value={form.calibration_frequency_days ?? undefined} onChange={(v) => set('calibration_frequency_days', v ?? null)} min={1} max={3650} className="w-full" placeholder="e.g. 365" />
        </F>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
