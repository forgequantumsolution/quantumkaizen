import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Select, Space, Switch, Table } from 'antd';
import { FlaskConical, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { ActiveBadge } from '@/components/ui';
import { useHasPermission } from '@/stores/authStore';
import {
  useLabs,
  useCreateLab,
  useUpdateLab,
  useDeleteLab,
  LAB_TYPE_LABELS,
  type Lab,
  type LabType,
  type LabUpsert,
} from '@/lib/api/lims';

const TYPE_OPTIONS = Object.entries(LAB_TYPE_LABELS).map(([v, label]) => ({ value: v, label }));

const TYPE_BADGE: Record<LabType, string> = {
  INTERNAL: 'bg-blue-50 text-blue-700 border-blue-200',
  PARTNER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CONTRACT: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function LabRegistryPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('lab.create');
  const canUpdate = useHasPermission('lab.update');
  const canDelete = useHasPermission('lab.delete');

  const [type, setType] = useState<LabType | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useLabs({ type, search: search || undefined });
  const rows = data?.data ?? [];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Lab | null>(null);

  const deleteMut = useDeleteLab();

  const onDelete = (l: Lab) =>
    modal.confirm({
      title: `Remove ${l.code}?`,
      content: `${l.name} will be removed from the registry.`,
      okText: 'Remove',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try { await deleteMut.mutateAsync(l.id); message.success('Lab removed'); }
        catch { message.error('Failed to remove'); }
      },
    });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical size={22} className="text-gray-500" />
            Lab Registry
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Internal, partner and contract laboratories — GMP classification and accreditation.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={type}
            onChange={setType}
            allowClear
            placeholder="All types"
            style={{ width: 160 }}
            options={TYPE_OPTIONS}
          />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name / location…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 260 }} />
          </div>
          {canCreate && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setDrawerOpen(true); }}>
              New Lab
            </Button>
          )}
        </div>
      </div>

      <Table<Lab>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          {
            title: 'Type',
            dataIndex: 'type',
            width: 110,
            render: (v: LabType) => (
              <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${TYPE_BADGE[v]}`}>
                {LAB_TYPE_LABELS[v]}
              </span>
            ),
          },
          { title: 'GMP', dataIndex: 'gmp_class', width: 90, render: (v: string | null) => v ?? '—' },
          { title: 'Site', dataIndex: 'site_code', width: 90, render: (v: string | null) => v ?? '—' },
          { title: 'Location', dataIndex: 'location', ellipsis: true, render: (v: string | null) => v ?? '—' },
          { title: 'Accreditation', dataIndex: 'accreditation', ellipsis: true, render: (v: string | null) => v ?? '—' },
          { title: 'Active', dataIndex: 'is_active', width: 90, render: (v: boolean) => <ActiveBadge active={v} /> },
          {
            title: '',
            width: 90,
            render: (_: unknown, r) => (
              <Space size={4}>
                {canUpdate && <Button size="small" icon={<Edit3 size={12} />} onClick={() => { setEditing(r); setDrawerOpen(true); }} />}
                {canDelete && <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => onDelete(r)} />}
              </Space>
            ),
          },
        ]}
      />

      <LabDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} lab={editing} />
    </PageContainer>
  );
}

function LabDrawer({ open, onClose, lab }: { open: boolean; onClose: () => void; lab: Lab | null }) {
  const { message } = App.useApp();
  const createMut = useCreateLab();
  const updateMut = useUpdateLab(lab?.id ?? '');

  const [form, setForm] = useState<LabUpsert>({ name: '', type: 'INTERNAL' });

  useEffect(() => {
    if (open) {
      setForm(
        lab
          ? {
              name: lab.name, type: lab.type, gmp_class: lab.gmp_class, site_code: lab.site_code,
              location: lab.location, accreditation: lab.accreditation, contact_name: lab.contact_name,
              contact_email: lab.contact_email, is_active: lab.is_active,
            }
          : { name: '', type: 'INTERNAL', is_active: true },
      );
    }
  }, [open, lab]);

  const set = <K extends keyof LabUpsert>(k: K, v: LabUpsert[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return message.error('Name is required');
    try {
      if (lab) { await updateMut.mutateAsync(form); message.success('Lab updated'); }
      else { await createMut.mutateAsync(form); message.success('Lab registered'); }
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed');
    }
  };

  return (
    <Drawer
      title={lab ? `Edit ${lab.code}` : 'New Lab'}
      open={open}
      onClose={onClose}
      width={460}
      destroyOnClose
      footer={
        <Space className="flex justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>
            {lab ? 'Save' : 'Register Lab'}
          </Button>
        </Space>
      }
    >
      <div className="space-y-3">
        <F label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Central QC Laboratory" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Type"><Select value={form.type} onChange={(v) => set('type', v)} options={TYPE_OPTIONS} className="w-full" /></F>
          <F label="GMP Class"><Input value={form.gmp_class ?? ''} onChange={(e) => set('gmp_class', e.target.value)} placeholder="GMP / Non-GMP" /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Site Code"><Input value={form.site_code ?? ''} onChange={(e) => set('site_code', e.target.value)} /></F>
          <F label="Location"><Input value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} /></F>
        </div>
        <F label="Accreditation"><Input value={form.accreditation ?? ''} onChange={(e) => set('accreditation', e.target.value)} placeholder="NABL, ISO 17025, USFDA…" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Contact Name"><Input value={form.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} /></F>
          <F label="Contact Email"><Input value={form.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value)} /></F>
        </div>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onChange={(v) => set('is_active', v)} /><span className="text-sm text-gray-700">Active</span></div>
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
