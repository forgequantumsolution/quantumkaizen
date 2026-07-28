import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Space, Switch, Table } from 'antd';
import { Truck, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { ActiveBadge } from '@/components/ui';
import { useHasPermission } from '@/stores/authStore';
import {
  useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier,
  type Supplier, type SupplierUpsert,
} from '@/lib/api/supplier';

export default function SuppliersPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('supplier.create');
  const canUpdate = useHasPermission('supplier.update');
  const canDelete = useHasPermission('supplier.delete');

  const [search, setSearch] = useState('');
  const { data, isLoading } = useSuppliers({ search: search || undefined });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const deleteMut = useDeleteSupplier();

  const onDelete = (s: Supplier) =>
    modal.confirm({ title: `Remove ${s.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(s.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Truck size={22} className="text-gray-500" />Vendor Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">External vendors of materials and services referenced across the LIMS.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name / contact…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Supplier</Button>}
        </div>
      </div>

      <Table<Supplier>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', width: 240, ellipsis: true },
          { title: 'Contact', dataIndex: 'contact_name', width: 160, render: (v: string | null) => v ?? '—' },
          { title: 'Country', dataIndex: 'country', width: 120, render: (v: string | null) => v ?? '—' },
          { title: 'Risk Tier', dataIndex: 'risk_tier', width: 110, render: (v: string | null) => <RiskTierBadge tier={v} /> },
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
      <SupplierDrawer open={open} onClose={() => setOpen(false)} supplier={editing} />
    </PageContainer>
  );
}

function SupplierDrawer({ open, onClose, supplier }: { open: boolean; onClose: () => void; supplier: Supplier | null }) {
  const { message } = App.useApp();
  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier(supplier?.id ?? '');
  const [form, setForm] = useState<SupplierUpsert>({ name: '' });

  useEffect(() => {
    if (open) setForm(supplier ? {
      name: supplier.name, contact_name: supplier.contact_name, email: supplier.email,
      country: supplier.country, is_active: supplier.is_active,
    } : { name: '', is_active: true });
  }, [open, supplier]);

  const set = <K extends keyof SupplierUpsert>(k: K, v: SupplierUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (supplier) { await updateMut.mutateAsync(form); message.success('Updated'); }
      else { await createMut.mutateAsync(form); message.success('Created'); }
      onClose();
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };

  return (
    <Drawer title={supplier ? `Edit ${supplier.code}` : 'New Supplier'} open={open} onClose={onClose} width={440} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{supplier ? 'Save' : 'Create'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Acme Reagents Ltd." /></F>
        <F label="Contact Name"><Input value={form.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} placeholder="Primary contact" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Email"><Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="contact@vendor.com" /></F>
          <F label="Country"><Input value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} placeholder="e.g. India" /></F>
        </div>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}

const RISK_TIER_STYLE: Record<string, string> = {
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function RiskTierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-gray-400 text-xs">—</span>;
  const cls = RISK_TIER_STYLE[tier.toUpperCase()] ?? 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {tier}
    </span>
  );
}
