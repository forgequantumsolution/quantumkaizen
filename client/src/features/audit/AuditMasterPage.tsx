import { useEffect, useState } from 'react';
import { Button, Drawer, Input, Select, Space, Spin, Switch, Table, message } from 'antd';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import {
  useAuditMasters,
  useCreateAuditMaster,
  useUpdateAuditMaster,
  useDeleteAuditMaster,
  useIsoStandards,
  type AuditFrequency,
  type AuditMaster,
  type AuditMasterUpsert,
  type AuditType,
} from '@/lib/api/audit';
import { useForms } from '@/features/forms/hooks';
import { useHasPermission } from '@/stores/authStore';

const AUDIT_TYPES: AuditType[] = [
  'INTERNAL',
  'EXTERNAL',
  'SUPPLIER',
  'PROCESS',
  'PRODUCT',
  'SYSTEM',
  'COMPLIANCE',
];
const FREQUENCIES: AuditFrequency[] = [
  'ONE_TIME',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'HALF_YEARLY',
  'ANNUAL',
];

export default function AuditMasterPage() {
  const canCreate = useHasPermission('audit_master.create');
  const canUpdate = useHasPermission('audit_master.update');
  const canDelete = useHasPermission('audit_master.delete');

  const { data, isLoading } = useAuditMasters({ page_size: 200 });
  const rows: AuditMaster[] = data?.data ?? [];
  const deleteMut = useDeleteAuditMaster();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AuditMaster | null>(null);

  const handleDelete = async (m: AuditMaster) => {
    if (!confirm(`Delete master "${m.code}"?`)) return;
    try {
      await deleteMut.mutateAsync(m.id);
      message.success('Audit master deleted');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Audit Master</h2>
          <p className="text-xs text-gray-500">
            Reusable audit templates — type, frequency, default checklist and ISO standard.
          </p>
        </div>
        {canCreate && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            New Master
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      ) : (
        <Table<AuditMaster>
          size="small"
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 30, showSizeChanger: false }}
          columns={[
            {
              title: 'Code',
              dataIndex: 'code',
              width: 140,
              render: (v: string) => <span className="font-mono text-blue-600">{v}</span>,
            },
            { title: 'Name', dataIndex: 'name', ellipsis: true },
            {
              title: 'Type',
              dataIndex: 'audit_type',
              width: 120,
              render: (v: AuditType) => (
                <span className="text-xs font-medium text-gray-700">
                  {v.replace(/_/g, ' ')}
                </span>
              ),
            },
            {
              title: 'Frequency',
              dataIndex: 'frequency',
              width: 110,
              render: (v: AuditFrequency) => v.replace(/_/g, ' '),
            },
            {
              title: 'Default Checklist',
              width: 200,
              render: (_: unknown, r) => r.default_checklist_form?.title ?? '—',
            },
            {
              title: 'ISO Standard',
              width: 160,
              render: (_: unknown, r) => r.default_iso_standard?.name ?? '—',
            },
            {
              title: 'Active',
              dataIndex: 'is_active',
              width: 80,
              render: (v: boolean) => (
                <span className={`text-xs ${v ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {v ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              title: 'Actions',
              width: 100,
              render: (_: unknown, r) => (
                <Space size={4}>
                  {canUpdate && (
                    <Button
                      size="small"
                      icon={<Edit3 size={12} />}
                      onClick={() => {
                        setEditing(r);
                        setDrawerOpen(true);
                      }}
                    />
                  )}
                  {canDelete && (
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={12} />}
                      onClick={() => handleDelete(r)}
                    />
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}

      <AuditMasterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        master={editing}
      />
    </>
  );
}

/* ─── Drawer ─── */

interface DraftMaster {
  code: string;
  name: string;
  description: string;
  audit_type: AuditType;
  frequency: AuditFrequency;
  default_iso_standard_id: string | null;
  default_checklist_form_id: string | null;
  is_active: boolean;
}

const initialDraft = (m: AuditMaster | null): DraftMaster => ({
  code: m?.code ?? '',
  name: m?.name ?? '',
  description: m?.description ?? '',
  audit_type: m?.audit_type ?? 'INTERNAL',
  frequency: m?.frequency ?? 'ANNUAL',
  default_iso_standard_id: m?.default_iso_standard?.id ?? null,
  default_checklist_form_id: m?.default_checklist_form?.id ?? null,
  is_active: m?.is_active ?? true,
});

function AuditMasterDrawer({
  open,
  onClose,
  master,
}: {
  open: boolean;
  onClose: () => void;
  master: AuditMaster | null;
}) {
  const [draft, setDraft] = useState<DraftMaster>(() => initialDraft(master));

  useEffect(() => {
    if (open) setDraft(initialDraft(master));
  }, [open, master]);

  const { data: checklists } = useForms({ kind: 'CHECKLIST', page_size: 200 });
  const checklistForms = checklists?.forms ?? [];

  const { data: isoData } = useIsoStandards();
  const isoStandards = isoData?.data ?? [];

  const createMut = useCreateAuditMaster();
  const updateMut = useUpdateAuditMaster(master?.id ?? '');

  const submit = async () => {
    if (!draft.code.trim() || !draft.name.trim()) {
      message.error('Code and Name are required');
      return;
    }
    const body: AuditMasterUpsert = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description || null,
      audit_type: draft.audit_type,
      frequency: draft.frequency,
      default_iso_standard_id: draft.default_iso_standard_id,
      default_checklist_form_id: draft.default_checklist_form_id,
      is_active: draft.is_active,
    };
    try {
      if (master) {
        await updateMut.mutateAsync(body);
        message.success('Audit master updated');
      } else {
        await createMut.mutateAsync(body);
        message.success('Audit master created');
      }
      onClose();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const update = <K extends keyof DraftMaster>(k: K, v: DraftMaster[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Drawer
      title={master ? `Edit ${master.code}` : 'New Audit Master'}
      open={open}
      onClose={onClose}
      width={520}
      destroyOnClose
      footer={
        <Space className="flex justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            onClick={submit}
            loading={createMut.isPending || updateMut.isPending}
          >
            {master ? 'Save' : 'Create'}
          </Button>
        </Space>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code *">
            <Input
              value={draft.code}
              onChange={(e) => update('code', e.target.value)}
              placeholder="AUD-INT-001"
            />
          </Field>
          <Field label="Active">
            <Switch
              checked={draft.is_active}
              onChange={(v) => update('is_active', v)}
            />
          </Field>
        </div>
        <Field label="Name *">
          <Input
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Internal Process Audit"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Audit Type *">
            <Select
              value={draft.audit_type}
              onChange={(v) => update('audit_type', v)}
              options={AUDIT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
              className="w-full"
            />
          </Field>
          <Field label="Frequency *">
            <Select
              value={draft.frequency}
              onChange={(v) => update('frequency', v)}
              options={FREQUENCIES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
              className="w-full"
            />
          </Field>
        </div>
        <Field label="Default ISO Standard">
          <Select
            value={draft.default_iso_standard_id ?? undefined}
            onChange={(v) => update('default_iso_standard_id', v ?? null)}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select an ISO standard"
            options={isoStandards.map((s) => ({ value: s.id, label: s.name }))}
            className="w-full"
          />
        </Field>
        <Field label="Default Checklist">
          <Select
            value={draft.default_checklist_form_id ?? undefined}
            onChange={(v) => update('default_checklist_form_id', v ?? null)}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select a checklist form"
            options={checklistForms.map((f) => ({ value: f.id, label: f.title }))}
            className="w-full"
          />
        </Field>
        <Field label="Description">
          <Input.TextArea
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
          />
        </Field>
      </div>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message ?? 'Operation failed'
  );
}
