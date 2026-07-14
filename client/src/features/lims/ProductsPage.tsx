import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Select, Space, Switch, Table } from 'antd';
import { Package, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { ActiveBadge } from '@/components/ui';
import { useHasPermission } from '@/stores/authStore';
import {
  useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  type Product, type ProductUpsert,
} from '@/lib/api/product';
import { useTestPanels } from '@/lib/api/testDefinition';

export default function ProductsPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('product.create');
  const canUpdate = useHasPermission('product.update');
  const canDelete = useHasPermission('product.delete');

  const [search, setSearch] = useState('');
  const { data, isLoading } = useProducts({ search: search || undefined });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const deleteMut = useDeleteProduct();

  const onDelete = (p: Product) =>
    modal.confirm({ title: `Remove ${p.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(p.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Package size={22} className="text-gray-500" />Products</h1>
          <p className="text-xs text-gray-500 mt-0.5">Finished and in-process products under test across the LIMS.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name / grade…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Product</Button>}
        </div>
      </div>

      <Table<Product>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', width: 240, ellipsis: true },
          { title: 'Grade', dataIndex: 'grade', width: 120, render: (v: string | null) => v ?? '—' },
          { title: 'Dosage Form', dataIndex: 'dosage_form', width: 130, render: (v: string | null) => v ?? '—' },
          { title: 'Category', dataIndex: 'category', width: 130, render: (v: string | null) => v ?? '—' },
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
      <ProductDrawer open={open} onClose={() => setOpen(false)} product={editing} />
    </PageContainer>
  );
}

function ProductDrawer({ open, onClose, product }: { open: boolean; onClose: () => void; product: Product | null }) {
  const { message } = App.useApp();
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct(product?.id ?? '');
  const { data: panels } = useTestPanels();
  const panelOpts = (panels?.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name} (${p.item_count} tests)` }));
  const [form, setForm] = useState<ProductUpsert>({ name: '' });

  useEffect(() => {
    if (open) setForm(product ? {
      name: product.name, grade: product.grade, dosage_form: product.dosage_form, strength: product.strength,
      category: product.category, markets: product.markets, default_panel_id: product.default_panel_id, is_active: product.is_active,
    } : { name: '', is_active: true });
  }, [open, product]);

  const set = <K extends keyof ProductUpsert>(k: K, v: ProductUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (product) { await updateMut.mutateAsync(form); message.success('Updated'); }
      else { await createMut.mutateAsync(form); message.success('Created'); }
      onClose();
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };

  return (
    <Drawer title={product ? `Edit ${product.code}` : 'New Product'} open={open} onClose={onClose} width={440} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{product ? 'Save' : 'Create'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Paracetamol Tablets" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Grade"><Input value={form.grade ?? ''} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. IP/BP" /></F>
          <F label="Dosage Form"><Input value={form.dosage_form ?? ''} onChange={(e) => set('dosage_form', e.target.value)} placeholder="Tablet, Capsule…" /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Strength"><Input value={form.strength ?? ''} onChange={(e) => set('strength', e.target.value)} placeholder="e.g. 500 mg" /></F>
          <F label="Category"><Input value={form.category ?? ''} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Analgesic" /></F>
        </div>
        <F label="Markets"><Input value={form.markets ?? ''} onChange={(e) => set('markets', e.target.value)} placeholder="Comma-separated, e.g. US, EU, IN" /></F>
        <F label="Default Test Panel"><Select allowClear showSearch optionFilterProp="label" className="w-full" placeholder="Auto-attached at sample login" value={form.default_panel_id ?? undefined} onChange={(v) => set('default_panel_id', v ?? null)} options={panelOpts} /></F>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
