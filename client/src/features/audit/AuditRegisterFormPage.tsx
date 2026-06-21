import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, DatePicker, Input, Select, Spin, message } from 'antd';
import { ArrowLeft } from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import {
  useAuditRegister,
  useCreateAuditRegister,
  useUpdateAuditRegister,
  useAuditMasters,
  useAuditTypes,
  useFocusAreas,
  useIsoStandards,
  type AuditMaster,
  type AuditRegister,
  type AuditRegisterUpsert,
  type ChecklistAssignment,
  type NamedRef,
} from '@/lib/api/audit';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useWorkflows } from '@/lib/api/workflow';

interface DraftState {
  title: string;
  audit_type: string;
  audit_master_id: string | null;
  plant: string;
  description: string;
  planned_date: Dayjs | null;
  financial_year: string;
  audit_method: string;
  iso_standard_id: string | null;
  focus_areas: NamedRef[];
  team_members: NamedRef[];
  checklist_assignments: ChecklistAssignment[];
  auditor_id: string | null;
  approver_id: string | null;
  workflow_id: string | null;
}

const initialDraft = (r: AuditRegister | null): DraftState => ({
  title: r?.title ?? '',
  audit_type: r?.audit_type ?? '',
  audit_master_id: r?.audit_master?.id ?? null,
  plant: r?.plant ?? '',
  description: r?.description ?? '',
  planned_date: r?.planned_date ? dayjs(r.planned_date) : null,
  financial_year: r?.financial_year ?? '',
  audit_method: r?.audit_method ?? '',
  iso_standard_id: r?.iso_standard?.id ?? null,
  focus_areas: r?.focus_areas ?? [],
  team_members: r?.team_members ?? [],
  checklist_assignments: r?.checklist_assignments ?? [],
  auditor_id: r?.auditor?.id ?? null,
  approver_id: r?.approver?.id ?? null,
  workflow_id: r?.workflow_id ?? null,
});

export default function AuditRegisterFormPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const isEdit = !!id;

  const { data: regData, isLoading: loadingReg } = useAuditRegister(id);
  const register = isEdit ? regData?.data ?? null : null;

  const [draft, setDraft] = useState<DraftState>(() => initialDraft(register));
  const [hydrated, setHydrated] = useState(!isEdit);

  useEffect(() => {
    if (isEdit && register && !hydrated) {
      setDraft(initialDraft(register));
      setHydrated(true);
    }
  }, [isEdit, register, hydrated]);

  const { data: mastersData } = useAuditMasters({ is_active: true, page_size: 100 });
  const masters: AuditMaster[] = mastersData?.data ?? [];

  const { data: auditTypesData } = useAuditTypes({ is_active: true, page_size: 200 });
  const auditTypes = auditTypesData?.data ?? [];

  const { data: focusAreasData } = useFocusAreas({ is_active: true, page_size: 200 });
  const focusAreaOptions = focusAreasData?.data ?? [];

  const { data: usersData } = useAdminUsers({ pageSize: 200, isActive: true });
  const users = usersData?.items ?? [];

  const { data: isoData } = useIsoStandards();
  const isoStandards = isoData?.data ?? [];

  // Workflows the audit can follow — only published/active ones, like Raise Ticket.
  const { data: workflowsData } = useWorkflows({ pageSize: 200, status: 'ACTIVE' });
  const activeWorkflows = (workflowsData?.items ?? []).filter(
    (w) => w.workflowStatus === 'ACTIVE',
  );

  const createMut = useCreateAuditRegister();
  const updateMut = useUpdateAuditRegister(id ?? '');

  const update = <K extends keyof DraftState>(k: K, v: DraftState[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Selecting a master auto-fills the config fields (still editable) and seeds
  // one checklist-assignment row per checklist defined on the master.
  const onMasterChange = (mid: string | null) => {
    const m = masters.find((x) => x.id === mid);
    setDraft((d) => ({
      ...d,
      audit_master_id: mid,
      ...(m
        ? {
            title: m.name,
            audit_type: m.audit_type,
            iso_standard_id: m.default_iso_standard?.id ?? d.iso_standard_id,
            description: m.description ?? d.description,
            checklist_assignments: m.checklist_forms.map((c) => ({
              checklist_form_id: c.id,
              checklist_title: c.title,
              members: [],
            })),
          }
        : {}),
    }));
  };

  // Team members drive who can be assigned to checklists; prune assignments that
  // reference a member that was just removed from the team.
  const onTeamChange = (memberIds: string[]) => {
    const members: NamedRef[] = memberIds.map((uid) => {
      const u = users.find((x) => x.id === uid);
      return { id: uid, name: u?.name ?? uid };
    });
    setDraft((d) => ({
      ...d,
      team_members: members,
      checklist_assignments: d.checklist_assignments.map((a) => ({
        ...a,
        members: a.members.filter((mm) => memberIds.includes(String(mm.id))),
      })),
    }));
  };

  const setAssignmentMembers = (checklistFormId: string, memberIds: string[]) =>
    setDraft((d) => ({
      ...d,
      checklist_assignments: d.checklist_assignments.map((a) =>
        a.checklist_form_id === checklistFormId
          ? {
              ...a,
              members: memberIds.map((uid) => {
                const tm = d.team_members.find((x) => String(x.id) === uid);
                return { id: uid, name: tm?.name ?? uid };
              }),
            }
          : a,
      ),
    }));

  const submit = async () => {
    const missing: string[] = [];
    if (!draft.audit_master_id) missing.push('Audit Master');
    if (!draft.title.trim()) missing.push('Title');
    if (!draft.audit_type) missing.push('Audit Type');
    if (!draft.planned_date) missing.push('Audit Date');
    if (!draft.financial_year.trim()) missing.push('Financial Year');
    if (!draft.plant.trim()) missing.push('Plant / Site');
    if (!draft.audit_method.trim()) missing.push('Audit Method');
    if (!draft.iso_standard_id) missing.push('ISO Standard');
    if (!draft.focus_areas.length) missing.push('Focus Areas');
    if (!draft.auditor_id) missing.push('Lead Auditor');
    if (!draft.team_members.length) missing.push('Audit Team Members');
    if (!draft.approver_id) missing.push('Approver');
    if (!draft.description.trim()) missing.push('Description');
    if (draft.checklist_assignments.some((a) => !a.members.length))
      missing.push('a member for every checklist');
    if (missing.length) {
      message.error(`Please provide: ${missing.join(', ')}`);
      return;
    }

    const body: AuditRegisterUpsert = {
      title: draft.title.trim(),
      audit_type: draft.audit_type,
      audit_master_id: draft.audit_master_id,
      plant: draft.plant || null,
      description: draft.description || null,
      planned_date: draft.planned_date!.toISOString(),
      financial_year: draft.financial_year || null,
      audit_method: draft.audit_method || null,
      iso_standard_id: draft.iso_standard_id,
      focus_areas: draft.focus_areas,
      team_members: draft.team_members,
      checklist_assignments: draft.checklist_assignments,
      checklist_form_id: draft.checklist_assignments[0]?.checklist_form_id ?? null,
      auditor_id: draft.auditor_id,
      approver_id: draft.approver_id,
      workflow_id: draft.workflow_id,
    };
    try {
      if (isEdit) {
        await updateMut.mutateAsync(body);
        message.success('Audit register updated');
        nav(`/audit/register/${id}`);
      } else {
        await createMut.mutateAsync(body);
        message.success('Audit register created');
        nav('/audit/register');
      }
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Save failed';
      message.error(msg);
    }
  };

  if (isEdit && loadingReg) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  if (isEdit && !register) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <p className="text-gray-500">Audit register not found.</p>
          <Link to="/audit/register" className="text-blue-600">
            Back to Audit Register
          </Link>
        </div>
      </PageContainer>
    );
  }

  const backTo = isEdit ? `/audit/register/${id}` : '/audit/register';
  const teamMemberOptions = draft.team_members.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
          <span className="text-gray-300">·</span>
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? `Edit ${register?.register_number}` : 'New Audit Register'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => nav(backTo)}>Cancel</Button>
          <Button
            type="primary"
            onClick={submit}
            loading={createMut.isPending || updateMut.isPending}
          >
            {isEdit ? 'Save changes' : 'Create draft'}
          </Button>
        </div>
      </div>

      {/* Master first — it auto-fills the rest. */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
        <Field label="Audit Master (template) *" className="md:col-span-2 xl:col-span-3">
          <Select
            value={draft.audit_master_id ?? undefined}
            onChange={(v) => onMasterChange(v ?? null)}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select an audit master — fields below auto-fill"
            options={masters.map((m) => ({
              value: m.id,
              label: m.code ? `${m.code} — ${m.name}` : m.name,
            }))}
            className="w-full"
          />
        </Field>

        <Field label="Title *" className="md:col-span-2 xl:col-span-3">
          <Input
            value={draft.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Q1 FY26 Internal Process Audit"
          />
        </Field>

        <Field label="Audit Type *">
          <Select
            value={draft.audit_type || undefined}
            onChange={(v) => update('audit_type', v ?? '')}
            showSearch
            optionFilterProp="label"
            placeholder="Select an audit type"
            options={auditTypes.map((t) => ({ value: t.name, label: t.name }))}
            className="w-full"
          />
        </Field>
        <Field label="Audit Date *">
          <DatePicker
            value={draft.planned_date ?? undefined}
            onChange={(d) => update('planned_date', d ?? null)}
            className="w-full"
          />
        </Field>
        <Field label="Financial Year *">
          <Input
            value={draft.financial_year}
            onChange={(e) => update('financial_year', e.target.value)}
            placeholder="FY 25-26"
          />
        </Field>

        <Field label="Plant / Site *">
          <Input value={draft.plant} onChange={(e) => update('plant', e.target.value)} />
        </Field>
        <Field label="Audit Method *">
          <Input
            value={draft.audit_method}
            onChange={(e) => update('audit_method', e.target.value)}
            placeholder="On-site / Remote / Hybrid"
          />
        </Field>
        <Field label="ISO Standard *">
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

        <Field label="Focus Areas *" className="md:col-span-2 xl:col-span-1">
          <Select
            mode="multiple"
            value={draft.focus_areas.map((f) => String(f.id))}
            onChange={(ids: string[]) =>
              update(
                'focus_areas',
                ids.map((fid) => {
                  const m = focusAreaOptions.find((o) => o.id === fid);
                  return { id: fid, name: m?.name ?? fid };
                }),
              )
            }
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select focus areas"
            options={focusAreaOptions.map((f) => ({ value: f.id, label: f.name }))}
            className="w-full"
          />
        </Field>

        <Field label="Lead Auditor *">
          <Select
            value={draft.auditor_id ?? undefined}
            onChange={(v) => update('auditor_id', v ?? null)}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select lead auditor (fixed)"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            className="w-full"
          />
        </Field>
        <Field label="Approver *">
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
        <Field label="Audit Workflow">
          <Select
            value={draft.workflow_id ?? undefined}
            onChange={(v) => update('workflow_id', v ?? null)}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Follow a workflow (optional)"
            options={activeWorkflows.map((w) => ({ value: w.id, label: w.name }))}
            className="w-full"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            On approval, the audit starts on this workflow — fill each stage's
            checklist on the workflow ticket.
          </p>
        </Field>
        <Field label="Audit Team Members *">
          <Select
            mode="multiple"
            value={draft.team_members.map((m) => String(m.id))}
            onChange={onTeamChange}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select audit team members"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            className="w-full"
          />
        </Field>
      </div>

      {/* Checklist → team member assignment (from the selected master). */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Checklist Assignments *</h3>
        <p className="text-xs text-gray-500 mb-3">
          Assign one or more team members to each checklist from the selected master. The
          Lead Auditor oversees all of them.
        </p>
        {draft.checklist_assignments.length === 0 ? (
          <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg px-4 py-6 text-center">
            {draft.audit_master_id
              ? 'The selected master has no checklists configured.'
              : 'Select an Audit Master above to load its checklists.'}
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {draft.checklist_assignments.map((a) => (
              <div
                key={a.checklist_form_id}
                className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-center"
              >
                <div className="text-sm font-medium text-gray-800 truncate">
                  {a.checklist_title}
                </div>
                <Select
                  mode="multiple"
                  value={a.members.map((m) => String(m.id))}
                  onChange={(ids: string[]) => setAssignmentMembers(a.checklist_form_id, ids)}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder={
                    draft.team_members.length
                      ? 'Assign team members'
                      : 'Select team members first'
                  }
                  options={teamMemberOptions}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 max-w-4xl">
        <Field label="Description *">
          <Input.TextArea
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="Scope, objectives, special notes…"
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
