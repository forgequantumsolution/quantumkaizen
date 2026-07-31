import { useEffect, useState } from 'react';
import { Alert, App, Button, Drawer, Input, Select, Space, Switch, Table } from 'antd';
import { Truck, Plus, Edit3, Trash2, Search } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import CalibrationPageHeader from './CalibrationPageHeader';
import {
  useProviders,
  useCreateProvider,
  useUpdateProvider,
  useDeleteProvider,
  useProviderPerformance,
  fmtDate,
  type Provider,
} from '@/lib/api/calibration';

export default function ProvidersPage() {
  const { modal, message } = App.useApp();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useProviders({ search: search || undefined });
  const { data: perf } = useProviderPerformance(180);
  const canCreate = useHasPermission('calibration_provider.create');
  const canUpdate = useHasPermission('calibration_provider.update');
  const canDelete = useHasPermission('calibration_provider.delete');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const del = useDeleteProvider();

  const rows = data?.data ?? [];
  const lapsed = rows.filter((r) => r.accreditation_lapsed && r.is_active);
  const perfMap = new Map((perf?.data ?? []).map((p) => [p.provider_id, p]));

  return (
    <PageContainer>
      <CalibrationPageHeader
        title="Calibration Providers"
        icon={Truck}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <Input placeholder="Name / accreditation no…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 230 }} />
            </div>
            {canCreate && (
              <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>
                New Provider
              </Button>
            )}
          </>
        }
      />

      {lapsed.length > 0 && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message={`${lapsed.length} active provider(s) with lapsed accreditation`}
          description={lapsed.map((l) => l.name).join(', ')}
        />
      )}

      <Table<Provider>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 90, render: (v: string) => <span className="font-mono text-xs text-blue-600">{v}</span> },
          { title: 'Provider', dataIndex: 'name', ellipsis: true },
          { title: 'Type', dataIndex: 'type', width: 120, render: (v: string) => <span className="text-xs">{v}</span> },
          {
            title: 'Accreditation',
            width: 190,
            render: (_: unknown, r) =>
              r.accreditation_body ? (
                <div>
                  <div className="text-xs">{r.accreditation_body} {r.accreditation_no}</div>
                  <div className={`text-[10px] ${r.accreditation_lapsed ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                    {r.accreditation_lapsed ? 'LAPSED ' : 'valid to '}
                    {fmtDate(r.accreditation_expiry)}
                  </div>
                </div>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              ),
          },
          {
            title: 'On-time',
            width: 90,
            align: 'right' as const,
            render: (_: unknown, r) => {
              const p = perfMap.get(r.id);
              return p?.on_time_rate === null || p?.on_time_rate === undefined ? (
                <span className="text-xs text-gray-400">—</span>
              ) : (
                <span className={`text-xs font-semibold ${p.on_time_rate < 80 ? 'text-amber-700' : ''}`}>{p.on_time_rate}%</span>
              );
            },
          },
          {
            title: 'As-found fail',
            width: 110,
            align: 'right' as const,
            render: (_: unknown, r) => {
              const p = perfMap.get(r.id);
              return p?.as_found_failure_rate === null || p?.as_found_failure_rate === undefined ? (
                <span className="text-xs text-gray-400">—</span>
              ) : (
                <span className="text-xs">{p.as_found_failure_rate}%</span>
              );
            },
          },
          { title: 'Records', dataIndex: 'event_count', width: 80, align: 'right' as const, render: (v?: number) => v ?? 0 },
          {
            title: '',
            width: 80,
            render: (_: unknown, r) => (
              <Space size={4}>
                {canUpdate && <Button size="small" icon={<Edit3 size={12} />} onClick={() => { setEditing(r); setOpen(true); }} />}
                {canDelete && (
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={12} />}
                    onClick={() =>
                      modal.confirm({
                        title: `Delete ${r.code}?`,
                        centered: true,
                        okButtonProps: { danger: true },
                        onOk: async () => {
                          try {
                            await del.mutateAsync(r.id);
                            message.success('Deleted');
                          } catch (e) {
                            message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
                          }
                        },
                      })
                    }
                  />
                )}
              </Space>
            ),
          },
        ]}
      />

      <ProviderDrawer open={open} onClose={() => setOpen(false)} provider={editing} />
    </PageContainer>
  );
}

function ProviderDrawer({ open, onClose, provider }: { open: boolean; onClose: () => void; provider: Provider | null }) {
  const { message } = App.useApp();
  const create = useCreateProvider();
  const update = useUpdateProvider(provider?.id ?? '');
  const [form, setForm] = useState<Record<string, unknown>>({ name: '', type: 'EXTERNAL', is_active: true });

  useEffect(() => {
    if (!open) return;
    setForm(provider ? { ...provider } : { name: '', type: 'EXTERNAL', is_active: true });
  }, [open, provider]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!String(form.name ?? '').trim()) return message.warning('Name is required');
    try {
      const body = form as unknown as Provider & { name: string };
      if (provider) await update.mutateAsync(body);
      else await create.mutateAsync(body);
      message.success('Saved');
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      title={provider ? `Edit ${provider.code}` : 'New provider'}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={create.isPending || update.isPending} onClick={save}>Save</Button>
        </Space>
      }
    >
      <div className="space-y-3">
        <L label="Name" required>
          <Input value={form.name as string} onChange={(e) => set('name', e.target.value)} />
        </L>
        <L label="Type">
          <Select
            className="w-full"
            value={form.type as string}
            onChange={(v) => set('type', v)}
            options={[
              { value: 'INTERNAL', label: 'Internal department' },
              { value: 'EXTERNAL', label: 'External agency' },
              { value: 'MANUFACTURER', label: 'Manufacturer' },
            ]}
          />
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label="Contact"><Input value={(form.contact_name as string) ?? ''} onChange={(e) => set('contact_name', e.target.value)} /></L>
          <L label="Email"><Input value={(form.email as string) ?? ''} onChange={(e) => set('email', e.target.value)} /></L>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <L label="Phone"><Input value={(form.phone as string) ?? ''} onChange={(e) => set('phone', e.target.value)} /></L>
          <L label="Country"><Input value={(form.country as string) ?? ''} onChange={(e) => set('country', e.target.value)} /></L>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Accreditation</h3>
          <div className="grid grid-cols-2 gap-3">
            <L label="Body" hint="NABL, A2LA, DAkkS, UKAS"><Input value={(form.accreditation_body as string) ?? ''} onChange={(e) => set('accreditation_body', e.target.value)} /></L>
            <L label="Number"><Input value={(form.accreditation_no as string) ?? ''} onChange={(e) => set('accreditation_no', e.target.value)} /></L>
          </div>
          <L label="Scope" hint="The measurement scope actually accredited — not the whole certificate.">
            <Input.TextArea rows={2} value={(form.accreditation_scope as string) ?? ''} onChange={(e) => set('accreditation_scope', e.target.value)} />
          </L>
          <L label="Expiry">
            <Input
              type="date"
              value={form.accreditation_expiry ? String(form.accreditation_expiry).slice(0, 10) : ''}
              onChange={(e) => set('accreditation_expiry', e.target.value || null)}
            />
          </L>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-700">Active</span>
          <Switch checked={form.is_active !== false} onChange={(v) => set('is_active', v)} />
        </div>
      </div>
    </Drawer>
  );
}

function L({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
