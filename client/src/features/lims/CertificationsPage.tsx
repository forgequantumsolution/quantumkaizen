import { useEffect, useState } from 'react';
import { App, AutoComplete, Button, DatePicker, Drawer, Input, Select, Space, Switch, Table } from 'antd';
import { BadgeCheck, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useCertifications, useCreateCertification, useUpdateCertification, useDeleteCertification, useLabs,
  type Certification, type CertUpsert, type ExpiryState,
} from '@/lib/api/lims';

const TYPE_SUGGESTIONS = [
  'GMP', 'NABL', 'ISO 17025', 'ISO 9001', 'USFDA', 'WHO-GMP',
  '21 CFR Part 11', 'ICH Q10', 'CDSCO', 'EMA', 'Health Canada', 'OTHER',
];
const STATE_BADGE: Record<ExpiryState, { cls: string; label: string }> = {
  valid: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Valid' },
  expiring: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Expiring' },
  expired: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Expired' },
};

export default function CertificationsPage() {
  const { modal, message } = App.useApp();
  const canCreate = useHasPermission('certification.create');
  const canUpdate = useHasPermission('certification.update');
  const canDelete = useHasPermission('certification.delete');

  const [expiring, setExpiring] = useState(false);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCertifications({ expiring: expiring || undefined, search: search || undefined });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Certification | null>(null);
  const deleteMut = useDeleteCertification();

  const onDelete = (c: Certification) =>
    modal.confirm({ title: `Remove ${c.code}?`, okText: 'Remove', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(c.id); message.success('Removed'); } catch { message.error('Failed'); } } });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BadgeCheck size={22} className="text-gray-500" />Certifications</h1>
          <p className="text-xs text-gray-500 mt-0.5">GMP / NABL / ISO / USFDA validity with expiry tracking and alerts.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button type={expiring ? 'primary' : 'default'} onClick={() => setExpiring((v) => !v)}>Expiring / expired</Button>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search type / number / code…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 250 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>New Certification</Button>}
        </div>
      </div>

      <Table<Certification>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Type', dataIndex: 'type', width: 120 },
          { title: 'Number', dataIndex: 'number', width: 160, ellipsis: true, render: (v: string | null) => v ?? '—' },
          { title: 'Lab', width: 220, ellipsis: true, render: (_: unknown, r) => r.lab_name ?? '—' },
          { title: 'Expiry', width: 120, render: (_: unknown, r) => new Date(r.expiry_date).toLocaleDateString() },
          {
            title: 'Status', width: 130,
            render: (_: unknown, r) => (
              <span className="flex items-center gap-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${STATE_BADGE[r.expiry_state].cls}`}>{STATE_BADGE[r.expiry_state].label}</span>
                <span className="text-[11px] text-gray-400">{r.days_to_expiry < 0 ? `${-r.days_to_expiry}d ago` : `${r.days_to_expiry}d`}</span>
              </span>
            ),
          },
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
      <CertDrawer open={open} onClose={() => setOpen(false)} cert={editing} />
    </PageContainer>
  );
}

function CertDrawer({ open, onClose, cert }: { open: boolean; onClose: () => void; cert: Certification | null }) {
  const { message } = App.useApp();
  const createMut = useCreateCertification();
  const updateMut = useUpdateCertification(cert?.id ?? '');
  const { data: labsData } = useLabs({ is_active: true });
  const labs = labsData?.data ?? [];

  const [type, setType] = useState('GMP');
  const [number, setNumber] = useState('');
  const [labId, setLabId] = useState<string | undefined>();
  const [issuedBy, setIssuedBy] = useState('');
  const [issueDate, setIssueDate] = useState<Dayjs | null>(null);
  const [expiryDate, setExpiryDate] = useState<Dayjs | null>(null);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setType(cert?.type ?? 'GMP'); setNumber(cert?.number ?? ''); setLabId(cert?.lab_id ?? undefined);
      setIssuedBy(cert?.issued_by ?? ''); setIssueDate(cert?.issue_date ? dayjs(cert.issue_date) : null);
      setExpiryDate(cert?.expiry_date ? dayjs(cert.expiry_date) : null); setIsActive(cert?.is_active ?? true);
    }
  }, [open, cert]);

  const submit = async () => {
    if (!type.trim()) return message.error('Type is required');
    if (!expiryDate) return message.error('Expiry date is required');
    const body: CertUpsert = {
      type, number: number || null, lab_id: labId ?? null, issued_by: issuedBy || null,
      issue_date: issueDate ? issueDate.toISOString() : null, expiry_date: expiryDate.toISOString(), is_active: isActive,
    };
    try {
      if (cert) { await updateMut.mutateAsync(body); message.success('Updated'); }
      else { await createMut.mutateAsync(body); message.success('Added'); }
      onClose();
    } catch (e) { message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed'); }
  };

  return (
    <Drawer title={cert ? `Edit ${cert.code}` : 'New Certification'} open={open} onClose={onClose} width={440} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>{cert ? 'Save' : 'Add'}</Button></Space>}>
      <div className="space-y-3">
        <F label="Type *">
          <AutoComplete
            value={type}
            onChange={setType}
            className="w-full"
            options={TYPE_SUGGESTIONS.map((t) => ({ value: t, label: t }))}
            filterOption={(input, option) =>
              (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
            placeholder="Pick a type or type a new one"
          />
        </F>
        <F label="Certificate Number"><Input value={number} onChange={(e) => setNumber(e.target.value)} /></F>
        <F label="Lab"><Select value={labId} onChange={setLabId} allowClear showSearch optionFilterProp="label" placeholder="Optional" className="w-full" options={labs.map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))} /></F>
        <F label="Issued By"><Input value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} placeholder="Accreditation body" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Issue Date"><DatePicker value={issueDate ?? undefined} onChange={(d) => setIssueDate(d ?? null)} className="w-full" /></F>
          <F label="Expiry Date *"><DatePicker value={expiryDate ?? undefined} onChange={(d) => setExpiryDate(d ?? null)} className="w-full" /></F>
        </div>
        <div className="flex items-center gap-2"><Switch checked={isActive} onChange={setIsActive} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Drawer>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
