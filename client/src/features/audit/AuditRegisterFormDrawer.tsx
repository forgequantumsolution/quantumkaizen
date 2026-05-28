import { useEffect, useState } from 'react';
import { Button, DatePicker, Drawer, Input, Select, Space, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  useCreateAuditRegister,
  useUpdateAuditRegister,
  useAuditMasters,
  useIsoStandards,
  type AuditMaster,
  type AuditRegister,
  type AuditRegisterUpsert,
  type AuditType,
} from '@/lib/api/audit';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useForms } from '@/features/forms/hooks';

const AUDIT_TYPES: AuditType[] = [
  'INTERNAL',
  'EXTERNAL',
  'SUPPLIER',
  'PROCESS',
  'PRODUCT',
  'SYSTEM',
  'COMPLIANCE',
];

interface Props {
  open: boolean;
  onClose: () => void;
  register: AuditRegister | null;
}

interface DraftState {
  title: string;
  audit_type: AuditType;
  audit_master_id: string | null;
  plant: string;
  description: string;
  planned_date: Dayjs | null;
  financial_year: string;
  audit_method: string;
  iso_standard_id: string | null;
  checklist_form_id: string | null;
  auditor_id: string | null;
  approver_id: string | null;
}

const initialDraft = (r: AuditRegister | null): DraftState => ({
  title: r?.title ?? '',
  audit_type: r?.audit_type ?? 'INTERNAL',
  audit_master_id: r?.audit_master?.id ?? null,
  plant: r?.plant ?? '',
  description: r?.description ?? '',
  planned_date: r?.planned_date ? dayjs(r.planned_date) : null,
  financial_year: r?.financial_year ?? '',
  audit_method: r?.audit_method ?? '',
  iso_standard_id: r?.iso_standard?.id ?? null,
  checklist_form_id: r?.checklist_form?.id ?? null,
  auditor_id: r?.auditor?.id ?? null,
  approver_id: r?.approver?.id ?? null,
});

export default function AuditRegisterFormDrawer({ open, onClose, register }: Props) {
  const [draft, setDraft] = useState<DraftState>(() => initialDraft(register));
  const isEdit = !!register;

  useEffect(() => {
    if (open) setDraft(initialDraft(register));
  }, [open, register]);

  const { data: mastersData } = useAuditMasters({ is_active: true, page_size: 100 });
  const masters: AuditMaster[] = mastersData?.data ?? [];

  const { data: usersData } = useAdminUsers({ pageSize: 200, isActive: true });
  const users = usersData?.items ?? [];

  const { data: checklists } = useForms({ kind: 'CHECKLIST', page_size: 100 });
  const checklistForms = checklists?.forms ?? [];

  const { data: isoData } = useIsoStandards();
  const isoStandards = isoData?.data ?? [];

  const createMut = useCreateAuditRegister();
  const updateMut = useUpdateAuditRegister(register?.id ?? '');

  const update = <K extends keyof DraftState>(k: K, v: DraftState[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const onMasterChange = (id: string | null) => {
    update('audit_master_id', id);
    const m = masters.find((x) => x.id === id);
    if (m) {
      update('audit_type', m.audit_type);
      if (m.default_checklist_form && !draft.checklist_form_id) {
        update('checklist_form_id', m.default_checklist_form.id);
      }
    }
  };

  const submit = async () => {
    if (!draft.title || !draft.planned_date) {
      message.error('Title and Planned Date are required');
      return;
    }
    const body: AuditRegisterUpsert = {
      title: draft.title.trim(),
      audit_type: draft.audit_type,
      audit_master_id: draft.audit_master_id,
      plant: draft.plant || null,
      description: draft.description || null,
      planned_date: draft.planned_date.toISOString(),
      financial_year: draft.financial_year || null,
      audit_method: draft.audit_method || null,
      iso_standard_id: draft.iso_standard_id,
      checklist_form_id: draft.checklist_form_id,
      auditor_id: draft.auditor_id,
      approver_id: draft.approver_id,
    };
    try {
      if (isEdit) {
        await updateMut.mutateAsync(body);
        message.success('Audit register updated');
      } else {
        await createMut.mutateAsync(body);
        message.success('Audit register created');
      }
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Save failed';
      message.error(msg);
    }
  };

  return (
    <Drawer
      title={isEdit ? `Edit ${register!.register_number}` : 'New Audit Register'}
      open={open}
      onClose={onClose}
      width={560}
      footer={
        <Space className="flex justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            onClick={submit}
            loading={createMut.isPending || updateMut.isPending}
          >
            {isEdit ? 'Save changes' : 'Create draft'}
          </Button>
        </Space>
      }
    >
      <div className="space-y-3">
        <Field label="Title *">
          <Input
            value={draft.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Q1 FY26 Internal Process Audit"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Audit Master (template)">
            <Select
              value={draft.audit_master_id ?? undefined}
              onChange={(v) => onMasterChange(v ?? null)}
              allowClear
              placeholder="Optional"
              options={masters.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))}
              className="w-full"
            />
          </Field>
          <Field label="Audit Type *">
            <Select
              value={draft.audit_type}
              onChange={(v) => update('audit_type', v)}
              options={AUDIT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
              className="w-full"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Planned Date *">
            <DatePicker
              value={draft.planned_date ?? undefined}
              onChange={(d) => update('planned_date', d ?? null)}
              className="w-full"
            />
          </Field>
          <Field label="Financial Year">
            <Input
              value={draft.financial_year}
              onChange={(e) => update('financial_year', e.target.value)}
              placeholder="FY 25-26"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Plant / Site">
            <Input
              value={draft.plant}
              onChange={(e) => update('plant', e.target.value)}
            />
          </Field>
          <Field label="Audit Method">
            <Input
              value={draft.audit_method}
              onChange={(e) => update('audit_method', e.target.value)}
              placeholder="On-site / Remote / Hybrid"
            />
          </Field>
        </div>

        <Field label="ISO Standard">
          <Select
            value={draft.iso_standard_id ?? undefined}
            onChange={(v) => update('iso_standard_id', v ?? null)}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select an ISO standard"
            options={isoStandards.map((s) => ({ value: s.id, label: s.name }))}
            className="w-full"
          />
        </Field>

        <Field label="Checklist Form">
          <Select
            value={draft.checklist_form_id ?? undefined}
            onChange={(v) => update('checklist_form_id', v ?? null)}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select an existing checklist"
            options={checklistForms.map((f) => ({ value: f.id, label: f.title }))}
            className="w-full"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Auditor">
            <Select
              value={draft.auditor_id ?? undefined}
              onChange={(v) => update('auditor_id', v ?? null)}
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Select auditor"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              className="w-full"
            />
          </Field>
          <Field label="Approver">
            <Select
              value={draft.approver_id ?? undefined}
              onChange={(v) => update('approver_id', v ?? null)}
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Select approver"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              className="w-full"
            />
          </Field>
        </div>

        <Field label="Description">
          <Input.TextArea
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="Scope, objectives, special notes…"
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
