import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Select, Spin, Switch, message } from 'antd';
import { ArrowLeft } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import {
  useAuditMasters,
  useCreateAuditMaster,
  useUpdateAuditMaster,
  useIsoStandards,
  type AuditFrequency,
  type AuditMaster,
  type AuditMasterUpsert,
  type AuditType,
  type ChecklistRef,
} from '@/lib/api/audit';
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
const FREQUENCIES: AuditFrequency[] = [
  'ONE_TIME',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'HALF_YEARLY',
  'ANNUAL',
];

interface DraftMaster {
  name: string;
  description: string;
  audit_type: AuditType;
  frequency: AuditFrequency;
  default_iso_standard_id: string | null;
  checklist_forms: ChecklistRef[];
  is_active: boolean;
}

const initialDraft = (m: AuditMaster | null): DraftMaster => ({
  name: m?.name ?? '',
  description: m?.description ?? '',
  audit_type: m?.audit_type ?? 'INTERNAL',
  frequency: m?.frequency ?? 'ANNUAL',
  default_iso_standard_id: m?.default_iso_standard?.id ?? null,
  checklist_forms: m?.checklist_forms ?? [],
  is_active: m?.is_active ?? true,
});

export default function AuditMasterFormPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const isEdit = !!id;

  // Single list query is cached and shared with the table; find the record for edit.
  const { data: listData, isLoading: loadingList } = useAuditMasters({ page_size: 200 });
  const master = isEdit ? listData?.data.find((m) => m.id === id) ?? null : null;

  const [draft, setDraft] = useState<DraftMaster>(() => initialDraft(master));
  const [hydrated, setHydrated] = useState(!isEdit);

  // Hydrate the form once the record arrives (edit mode).
  useEffect(() => {
    if (isEdit && master && !hydrated) {
      setDraft(initialDraft(master));
      setHydrated(true);
    }
  }, [isEdit, master, hydrated]);

  const { data: checklists } = useForms({ kind: 'CHECKLIST', page_size: 200 });
  const checklistForms = checklists?.forms ?? [];

  const { data: isoData } = useIsoStandards();
  const isoStandards = isoData?.data ?? [];

  const createMut = useCreateAuditMaster();
  const updateMut = useUpdateAuditMaster(id ?? '');

  const update = <K extends keyof DraftMaster>(k: K, v: DraftMaster[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    if (!draft.name.trim()) {
      message.error('Name is required');
      return;
    }
    const body: AuditMasterUpsert = {
      name: draft.name.trim(),
      description: draft.description || null,
      audit_type: draft.audit_type,
      frequency: draft.frequency,
      default_iso_standard_id: draft.default_iso_standard_id,
      checklist_forms: draft.checklist_forms,
      is_active: draft.is_active,
    };
    try {
      if (isEdit) {
        await updateMut.mutateAsync(body);
        message.success('Audit master updated');
      } else {
        await createMut.mutateAsync(body);
        message.success('Audit master created');
      }
      nav('/audit/master');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  if (isEdit && loadingList) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  if (isEdit && !master) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <p className="text-gray-500">Audit master not found.</p>
          <Link to="/audit/master" className="text-blue-600">
            Back to Audit Master
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/audit/master"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
          <span className="text-gray-300">·</span>
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? `Edit ${master?.code}` : 'New Audit Master'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => nav('/audit/master')}>Cancel</Button>
          <Button
            type="primary"
            onClick={submit}
            loading={createMut.isPending || updateMut.isPending}
          >
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
        <Field label="Name *" className="md:col-span-2 xl:col-span-2">
          <Input
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Internal Process Audit"
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
        <Field label="Frequency *">
          <Select
            value={draft.frequency}
            onChange={(v) => update('frequency', v)}
            options={FREQUENCIES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
            className="w-full"
          />
        </Field>
        <Field label="Active">
          <Switch checked={draft.is_active} onChange={(v) => update('is_active', v)} />
        </Field>
        <Field label="ISO Standard">
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
        <Field label="Checklist" className="md:col-span-2 xl:col-span-1">
          <Select
            mode="multiple"
            value={draft.checklist_forms.map((c) => c.id)}
            onChange={(ids: string[]) =>
              update(
                'checklist_forms',
                ids.map((id) => {
                  const f = checklistForms.find((o) => o.id === id);
                  return { id, title: f?.title ?? id } as ChecklistRef;
                }),
              )
            }
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select one or more checklist forms"
            options={checklistForms.map((f) => ({ value: f.id, label: f.title }))}
            className="w-full"
          />
        </Field>
        <Field label="Description" className="md:col-span-2 xl:col-span-3">
          <Input.TextArea
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
          />
        </Field>
      </div>
    </PageContainer>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message ?? 'Operation failed'
  );
}
