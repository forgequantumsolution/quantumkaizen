import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, DatePicker, Drawer, Input, InputNumber, Select, Space, Table } from 'antd';
import { TestTubes, Plus, Search } from 'lucide-react';
import type { Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import UnitSelect from './UnitSelect';
import { useHasPermission } from '@/stores/authStore';
import {
  useSamples, useRegisterSample, useStorageLocations,
  SAMPLE_STATUS_LABELS, type SampleSummary, type SampleStatus, type RegisterSampleBody,
} from '@/lib/api/samples';
import { useSpecs, useLabs } from '@/lib/api/lims';
import { useProducts } from '@/lib/api/product';
import { useCustomers } from '@/lib/api/customer';
import { useSuppliers } from '@/lib/api/supplier';
import { useSamplingPoints } from '@/lib/api/samplingPoint';

export const STATUS_BADGE: Record<SampleStatus, string> = {
  REGISTERED: 'bg-gray-100 text-gray-700 border-gray-200',
  IN_TESTING: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  RELEASED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};
const SAMPLE_TYPES = ['Raw Material', 'Finished Product', 'In-Process', 'Stability', 'Water', 'Environmental'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

const PRIORITY_BADGE: Record<string, string> = {
  Low: 'bg-slate-100 text-slate-600 border-slate-200',
  Normal: 'bg-blue-50 text-blue-700 border-blue-200',
  High: 'bg-amber-50 text-amber-700 border-amber-200',
  Urgent: 'bg-red-50 text-red-700 border-red-200',
};

export default function SampleListPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('sample.create');
  const [status, setStatus] = useState<SampleStatus | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useSamples({ status, search: search || undefined });
  const rows = data?.data ?? [];
  const [open, setOpen] = useState(false);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TestTubes size={22} className="text-gray-500" />Sample Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">Register samples with a barcode and an unbroken chain of custody.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={status} onChange={setStatus} allowClear placeholder="All statuses" style={{ width: 160 }}
            options={Object.entries(SAMPLE_STATUS_LABELS).map(([v, label]) => ({ value: v, label }))} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search no. / barcode / product / batch…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 280 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>Register Sample</Button>}
        </div>
      </div>

      <Table<SampleSummary>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        onRow={(r) => ({ onClick: () => nav(`/lims/samples/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Sample No.', dataIndex: 'sample_number', width: 150, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Barcode', dataIndex: 'barcode', width: 150, render: (v: string | null) => v ? <span className="font-mono text-gray-600 text-xs">{v}</span> : '—' },
          { title: 'Product', dataIndex: 'product_name', ellipsis: true, width: 240 },
          { title: 'Batch', dataIndex: 'batch_no', width: 120, render: (v: string | null) => v ? <span className="font-mono">{v}</span> : '—' },
          { title: 'Type', dataIndex: 'sample_type', width: 140, render: (v: string | null) => v ?? '—' },
          {
            title: 'Priority', dataIndex: 'priority', width: 100,
            render: (v: string | null) => v ? <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${PRIORITY_BADGE[v] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{v}</span> : '—',
          },
          {
            title: 'Quantity', width: 110, align: 'right',
            render: (_: unknown, r) => r.quantity != null ? <span className="font-mono text-gray-700">{r.quantity}{r.unit ? ` ${r.unit}` : ''}</span> : '—',
          },
          { title: 'Aliquots', dataIndex: 'aliquot_count', width: 90, align: 'right' },
          {
            title: 'Status', width: 120,
            render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${STATUS_BADGE[r.status]}`}>{SAMPLE_STATUS_LABELS[r.status]}</span>,
          },
          { title: 'Registered', width: 120, render: (_: unknown, r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <RegisterDrawer open={open} onClose={() => setOpen(false)} onDone={(id) => { setOpen(false); nav(`/lims/samples/${id}`); }} />
    </PageContainer>
  );
}

function RegisterDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const { message } = App.useApp();
  const registerMut = useRegisterSample();

  const [f, setF] = useState<RegisterSampleBody>({ product_name: '' });
  const [collected, setCollected] = useState<Dayjs | null>(null);
  const [received, setReceived] = useState<Dayjs | null>(null);
  const set = <K extends keyof RegisterSampleBody>(k: K, v: RegisterSampleBody[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.product_name?.trim()) return message.error('Product name is required');
    try {
      const created = await registerMut.mutateAsync({ ...f, collected_at: collected ? collected.toISOString() : null, received_at: received ? received.toISOString() : null });
      message.success(`Registered ${created.sample_number}`);
      setF({ product_name: '' }); setCollected(null); setReceived(null);
      onDone(created.id);
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed'); }
  };

  return (
    <Drawer title="Register Sample" open={open} onClose={onClose} width={480} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={registerMut.isPending}>Register</Button></Space>}>
      {/* The dropdown lookup queries live in RegisterFields, which only mounts
          while the drawer is open — so those 7 fetches fire on first open, not on
          page load. The Drawer shell stays mounted so its open/close animation is
          preserved. */}
      {open && (
        <RegisterFields
          f={f} setF={setF} set={set}
          collected={collected} setCollected={setCollected}
          received={received} setReceived={setReceived}
        />
      )}
    </Drawer>
  );
}

interface RegisterFieldsProps {
  f: RegisterSampleBody;
  setF: React.Dispatch<React.SetStateAction<RegisterSampleBody>>;
  set: <K extends keyof RegisterSampleBody>(k: K, v: RegisterSampleBody[K]) => void;
  collected: Dayjs | null;
  setCollected: (d: Dayjs | null) => void;
  received: Dayjs | null;
  setReceived: (d: Dayjs | null) => void;
}

function RegisterFields({ f, setF, set, collected, setCollected, received, setReceived }: RegisterFieldsProps) {
  const { data: specs } = useSpecs({ status: 'APPROVED' });
  const { data: labsData } = useLabs({ is_active: true });
  const { data: storage } = useStorageLocations();
  const { data: productsData } = useProducts();
  const { data: customersData } = useCustomers();
  const { data: suppliersData } = useSuppliers();
  const { data: samplingPointsData } = useSamplingPoints();
  const products = productsData?.data ?? [];
  const labs = labsData?.data ?? [];
  const customers = customersData?.data ?? [];
  const suppliers = suppliersData?.data ?? [];
  const samplingPoints = samplingPointsData?.data ?? [];

  return (
      <div className="space-y-3">
        <F label="Product (master)">
          <Select
            value={f.product_id ?? undefined}
            onChange={(v) => { const p = products.find((x) => x.id === v); setF((prev) => ({ ...prev, product_id: v ?? null, product_name: p ? p.name : prev.product_name })); }}
            allowClear showSearch optionFilterProp="label" className="w-full"
            placeholder="Link to a product (auto-attaches its test panel + spec)"
            options={products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </F>
        <F label="Product / Material name *"><Input value={f.product_name} onChange={(e) => set('product_name', e.target.value)} placeholder="Auto-filled from the product, or type a free-text name" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Batch No."><Input value={f.batch_no ?? ''} onChange={(e) => set('batch_no', e.target.value)} /></F>
          <F label="Type"><Select value={f.sample_type ?? undefined} onChange={(v) => set('sample_type', v)} allowClear className="w-full" options={SAMPLE_TYPES.map((t) => ({ value: t, label: t }))} /></F>
        </div>
        <F label="Specification"><Select value={f.specification_id ?? undefined} onChange={(v) => set('specification_id', v ?? null)} allowClear showSearch optionFilterProp="label" placeholder="Approved spec" className="w-full" options={(specs?.data ?? []).map((s) => ({ value: s.id, label: `${s.code} — ${s.product_name}` }))} /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Lab"><Select value={f.lab_id ?? undefined} onChange={(v) => set('lab_id', v ?? null)} allowClear showSearch optionFilterProp="label" className="w-full" options={labs.map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))} /></F>
          <F label="Priority"><Select value={f.priority ?? undefined} onChange={(v) => set('priority', v)} allowClear className="w-full" options={PRIORITIES.map((p) => ({ value: p, label: p }))} /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Quantity"><InputNumber value={f.quantity ?? undefined} onChange={(v) => set('quantity', v ?? null)} min={0} className="w-full" /></F>
          <F label="Unit"><UnitSelect value={f.unit} onChange={(v) => set('unit', v)} placeholder="g, mL…" /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Collected"><DatePicker value={collected ?? undefined} onChange={(d) => setCollected(d ?? null)} className="w-full" /></F>
          <F label="Received"><DatePicker value={received ?? undefined} onChange={(d) => setReceived(d ?? null)} className="w-full" /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Customer"><Select value={f.customer_id ?? undefined} onChange={(v) => set('customer_id', v ?? null)} allowClear showSearch optionFilterProp="label" className="w-full" placeholder="CoA recipient" options={customers.map((c) => ({ value: c.id, label: `${c.name}${c.country ? ` · ${c.country}` : ''}` }))} /></F>
          <F label="Sampling Point"><Select value={f.sampling_point_id ?? undefined} onChange={(v) => set('sampling_point_id', v ?? null)} allowClear showSearch optionFilterProp="label" className="w-full" placeholder="Where drawn" options={samplingPoints.map((sp) => ({ value: sp.id, label: `${sp.code} — ${sp.name}` }))} /></F>
        </div>
        {f.sample_type === 'Raw Material' && (
          <F label="Supplier / Vendor"><Select value={f.supplier_id ?? undefined} onChange={(v) => set('supplier_id', v ?? null)} allowClear showSearch optionFilterProp="label" className="w-full" placeholder="Material source" options={suppliers.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))} /></F>
        )}
        <F label="Source Site"><Input value={f.source_site ?? ''} onChange={(e) => set('source_site', e.target.value)} /></F>
        <F label="Initial Storage"><Select value={f.current_location_id ?? undefined} onChange={(v) => set('current_location_id', v ?? null)} allowClear showSearch optionFilterProp="label" className="w-full" options={(storage?.data ?? []).map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))} /></F>
        <F label="Remarks"><Input.TextArea rows={2} value={f.remarks ?? ''} onChange={(e) => set('remarks', e.target.value)} /></F>
      </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
