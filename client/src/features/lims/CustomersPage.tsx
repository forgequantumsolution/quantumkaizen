import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Space, Switch, Table } from 'antd';
import { Users, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer,
  type Customer, type CustomerUpsert,
} from '@/lib/api/customer';

export default function CustomersPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('customer.create');
  const canUpdate = useHasPermission('customer.update');
  const canDelete = useHasPermission('customer.delete');

  const [search, setSearch] = useState('');
  const { data, isLoading } = useCustomers({ search: search || undefined });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const deleteMut = useDeleteCustomer();

  const onDelete = (c: Customer) =>
    modal.confirm({ title: `Remove ${c.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(c.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users size={22} className="text-gray-500" />Customers</h1>
          <p className="text-xs text-gray-500 mt-0.5">Customer master data for test requests and reporting.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name / contact…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Customer</Button>}
        </div>
      </div>

      <Table<Customer>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          { title: 'Contact', dataIndex: 'contact_name', width: 160, render: (v: string | null) => v ?? '—' },
          { title: 'Country', dataIndex: 'country', width: 130, render: (v: string | null) => v ?? '—' },
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
      <CustomerDrawer open={open} onClose={() => setOpen(false)} customer={editing} />
    </PageContainer>
  );
}

function CustomerDrawer({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: Customer | null }) {
  const { message } = App.useApp();
  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer(customer?.id ?? '');
  const [form, setForm] = useState<CustomerUpsert>({ name: '' });

  useEffect(() => {
    if (open) setForm(customer ? {
      name: customer.name, contact_name: customer.contact_name, email: customer.email,
      country: customer.country, is_active: customer.is_active,
    } : { name: '', is_active: true });
  }, [open, customer]);

  const set = <K extends keyof CustomerUpsert>(k: K, v: CustomerUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (customer) { await updateMut.mutateAsync(form); message.success('Updated'); }
      else { await createMut.mutateAsync(form); message.success('Created'); }
      onClose();
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };

  return (
    <Drawer title={customer ? `Edit ${customer.code}` : 'New Customer'} open={open} onClose={onClose} width={440} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{customer ? 'Save' : 'Create'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Acme Pharma Ltd." /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Contact Name"><Input value={form.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} /></F>
          <F label="Country"><Input value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} placeholder="India, USA…" /></F>
        </div>
        <F label="Email"><Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="contact@example.com" /></F>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
