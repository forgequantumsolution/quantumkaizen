import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Modal as AntModal, Select as AntSelect, Input as AntInput, message } from 'antd';
import { DataTable } from '@/components/ui';
import { ArrowLeft, Plus } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, Button, Tabs, Spinner } from '@/components/ui';
import {
  useActionItems,
  useAuditTrail,
  useCapa,
  useCreateActionItem,
  useSignatures,
  useSignEntity,
  useUpdateActionItemStatus,
  useUpdateCapa,
  useUpdateCapaStatus,
  type ActionItem,
  type ActionItemStatus,
  type Capa,
  type CapaType,
  type CapaUpdate,
} from '@/lib/api/audit';
import { useTicket } from '@/lib/api/ticket';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useHasPermission } from '@/stores/authStore';
import {
  ActionStatusBadge,
  ActionPriorityBadge,
  CapaStatusBadge,
  NcStatusBadge,
} from './auditStatusBadge';
import CapaWorkflowBand from './capa/CapaWorkflowBand';
import CapaSidebar from './capa/CapaSidebar';
import RootCauseTab from './capa/RootCauseTab';
import EffectivenessTab from './capa/EffectivenessTab';
import StageFormSection from '@/features/tickets/detail/StageFormSection';
import TicketFormHistory from '@/features/tickets/detail/TicketFormHistory';

const TYPES: CapaType[] = ['CORRECTIVE', 'PREVENTIVE', 'BOTH'];
const ACTION_STATUSES: ActionItemStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED'];

export default function CapaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: c, isLoading } = useCapa(id);
  const canUpdate = useHasPermission('capa.update');
  const statusMut = useUpdateCapaStatus();
  const [tab, setTab] = useState('details');

  if (isLoading || !c) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  const closed = c.status === 'CLOSED' || c.status === 'CANCELLED';
  const canEdit = canUpdate && !closed;
  const hasWorkflow = !!c.workflow_ticket_id;

  const tabs = [
    { id: 'details', label: 'Details' },
    ...(hasWorkflow ? [{ id: 'forms', label: 'Stage Forms' }] : []),
    { id: 'rca', label: 'Root Cause' },
    { id: 'actions', label: 'Actions', count: c.action_item_count },
    { id: 'effectiveness', label: 'Effectiveness' },
    { id: 'history', label: 'History' },
  ];

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => nav('/audit/capa')}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{c.capa_number}</span>
          <CapaStatusBadge status={c.status} />
        </div>
        {canUpdate && !closed && (
          <Button
            variant="danger"
            size="sm"
            isLoading={statusMut.isPending}
            onClick={() =>
              statusMut.mutate(
                { id: c.id, status: 'CANCELLED' },
                {
                  onSuccess: () => message.success('CAPA cancelled'),
                  onError: (err) => message.error(extractErr(err)),
                },
              )
            }
          >
            Cancel CAPA
          </Button>
        )}
      </div>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{c.title}</h2>

      {/* Workflow flow band (hybrid strip + canvas + transitions) */}
      <div className="mb-4 space-y-3">
        <CapaWorkflowBand capa={c} />
      </div>

      {/* Body: tabs + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="mb-3">
            <Tabs tabs={tabs} activeTab={tab} onTabChange={setTab} />
          </div>
          {tab === 'details' && <DetailsTab capa={c} canEdit={canEdit} />}
          {tab === 'forms' && hasWorkflow && <StageFormsPanel ticketId={c.workflow_ticket_id!} />}
          {tab === 'rca' && (
            <RootCauseTab capa={c} canEdit={canEdit && !hasWorkflow} mirrored={hasWorkflow} />
          )}
          {tab === 'actions' && <ActionsTab capa={c} />}
          {tab === 'effectiveness' && (
            <EffectivenessTab capa={c} canEdit={canEdit && !hasWorkflow} mirrored={hasWorkflow} />
          )}
          {tab === 'history' && <TrailTab capaId={c.id} />}
        </div>
        <CapaSidebar capa={c} />
      </div>
    </PageContainer>
  );
}

/* ── Stage forms panel (workflow) ── */
function StageFormsPanel({ ticketId }: { ticketId: string }) {
  const { data: ticket } = useTicket(ticketId);
  const flow = ticket?.flows[0];
  return (
    <div className="space-y-4">
      <StageFormSection ticketId={ticketId} />
      <TicketFormHistory
        ticketId={ticketId}
        selectedStageId={null}
        currentStageIds={flow?.currentStages.map((s) => s.id) ?? []}
        isCompleted={!!flow?.isCompleted}
      />
    </div>
  );
}

/* ── Details tab ── */
function DetailsTab({ capa, canEdit }: { capa: Capa; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="mb-2 flex justify-end">
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Edit
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
        <Info label="Type" value={capa.type} />
        <Info label="Owner" value={capa.owner?.name ?? '—'} />
        <Info label="Department" value={capa.department?.name ?? '—'} />
        <Info
          label="Due date"
          value={capa.due_date ? new Date(capa.due_date).toLocaleDateString() : '—'}
        />
        <Info label="Created by" value={capa.created_by?.name ?? '—'} />
        <Info
          label="Source NC"
          value={
            capa.non_conformance ? (
              <Link
                to="/audit/non-conformance"
                className="font-mono text-emerald-700 hover:underline"
              >
                {capa.non_conformance.ncNumber}
              </Link>
            ) : (
              '—'
            )
          }
        />
      </div>
      {capa.non_conformance && (
        <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">From finding</span>
            <NcStatusBadge status={capa.non_conformance.status} />
          </div>
          <p className="text-gray-700">{capa.non_conformance.finding?.description ?? '—'}</p>
        </div>
      )}
      {capa.description && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Description</div>
          <p className="whitespace-pre-wrap text-sm text-gray-800 gmp-narrative">{capa.description}</p>
        </div>
      )}
      <EditCapaModal capa={capa} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function EditCapaModal({ capa, open, onClose }: { capa: Capa; open: boolean; onClose: () => void }) {
  const updateMut = useUpdateCapa(capa.id);
  const { data: usersData } = useUserDirectory();
  const { data: deptsResp } = useDepartments({ pageSize: 200 });
  const users = usersData?.items ?? [];
  const departments = deptsResp?.items ?? [];

  const [title, setTitle] = useState(capa.title);
  const [description, setDescription] = useState(capa.description ?? '');
  const [type, setType] = useState<CapaType>(capa.type);
  const [ownerId, setOwnerId] = useState<string | undefined>(capa.owner?.id);
  const [departmentId, setDepartmentId] = useState<string | undefined>(capa.department?.id);
  const [dueDate, setDueDate] = useState(capa.due_date ? capa.due_date.slice(0, 10) : '');

  useEffect(() => {
    if (open) {
      setTitle(capa.title);
      setDescription(capa.description ?? '');
      setType(capa.type);
      setOwnerId(capa.owner?.id);
      setDepartmentId(capa.department?.id);
      setDueDate(capa.due_date ? capa.due_date.slice(0, 10) : '');
    }
  }, [open, capa]);

  const submit = async () => {
    const body: CapaUpdate = {
      title: title.trim(),
      description: description || null,
      type,
      owner_id: ownerId ?? null,
      department_id: departmentId ?? null,
      due_date: dueDate || null,
    };
    try {
      await updateMut.mutateAsync(body);
      message.success('CAPA updated');
      onClose();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <AntModal
      title="Edit CAPA"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okButtonProps={{ loading: updateMut.isPending }}
    >
      <div className="space-y-3">
        <Labeled label="Title">
          <AntInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </Labeled>
        <Labeled label="Type">
          <AntSelect
            value={type}
            onChange={setType}
            options={TYPES.map((t) => ({ value: t, label: t }))}
            className="w-full"
          />
        </Labeled>
        <Labeled label="Owner">
          <AntSelect
            value={ownerId}
            onChange={setOwnerId}
            allowClear
            showSearch
            optionFilterProp="label"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            className="w-full"
          />
        </Labeled>
        <Labeled label="Department">
          <AntSelect
            value={departmentId}
            onChange={setDepartmentId}
            allowClear
            showSearch
            optionFilterProp="label"
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            className="w-full"
          />
        </Labeled>
        <Labeled label="Due date">
          <AntInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Labeled>
        <Labeled label="Description">
          <AntInput.TextArea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Labeled>
      </div>
    </AntModal>
  );
}

/* ── Actions tab ── */
function ActionsTab({ capa }: { capa: Capa }) {
  const { data } = useActionItems({ capa_id: capa.id, page_size: 200 });
  const rows = data?.data ?? [];
  const canCreate = useHasPermission('action_item.create');
  const canUpdate = useHasPermission('action_item.update');
  const createMut = useCreateActionItem();
  const statusMut = useUpdateActionItemStatus();
  const { data: usersData } = useUserDirectory();
  const users = usersData?.items ?? [];

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState('');

  const add = async () => {
    if (!title.trim()) {
      message.error('Title is required');
      return;
    }
    try {
      await createMut.mutateAsync({
        title: title.trim(),
        capa_id: capa.id,
        owner_id: ownerId ?? null,
        due_date: dueDate || null,
      });
      message.success('Action item added');
      setOpen(false);
      setTitle('');
      setOwnerId(undefined);
      setDueDate('');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {rows.length} action{rows.length === 1 ? '' : 's'} defined
        </h3>
        {canCreate && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus size={12} /> Add action
          </Button>
        )}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <DataTable<ActionItem>
          data={rows}
          pageSize={1000}
          emptyMessage="No action items yet"
          columns={[
            {
              key: 'action_number',
              header: 'Action #',
              render: (r) => <span className="font-mono text-blue-600">{r.action_number}</span>,
            },
            { key: 'title', header: 'Title' },
            { key: 'owner', header: 'Owner', sortable: false, render: (r) => r.owner?.name ?? '—' },
            {
              key: 'priority',
              header: 'Priority',
              sortable: false,
              render: (r) => <ActionPriorityBadge priority={r.priority} />,
            },
            {
              key: 'due_date',
              header: 'Due',
              render: (r) => (r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: false,
              render: (r) =>
                canUpdate ? (
                  <AntSelect
                    size="small"
                    value={r.status}
                    onChange={(s) => statusMut.mutate({ id: r.id, status: s })}
                    options={ACTION_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                    className="w-full min-w-[140px]"
                  />
                ) : (
                  <ActionStatusBadge status={r.status as ActionItemStatus} />
                ),
            },
          ]}
        />
      </div>

      {/* Simple timeline — one bar per action, coloured by state. */}
      {rows.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Timeline
          </div>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-gray-500">Action {i + 1}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${actionBarColor(r)}`} style={{ width: '100%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AntModal
        title="Add action item"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={add}
        okText="Add"
        okButtonProps={{ loading: createMut.isPending }}
      >
        <div className="space-y-3">
          <Labeled label="Title *">
            <AntInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Labeled>
          <Labeled label="Owner">
            <AntSelect
              value={ownerId}
              onChange={setOwnerId}
              allowClear
              showSearch
              optionFilterProp="label"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              className="w-full"
            />
          </Labeled>
          <Labeled label="Due date">
            <AntInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Labeled>
        </div>
      </AntModal>
    </Card>
  );
}

function actionBarColor(a: ActionItem): string {
  if (a.status === 'DONE' || a.status === 'VERIFIED') return 'bg-emerald-500';
  if (a.status === 'CANCELLED') return 'bg-gray-300';
  if (a.due_date && new Date(a.due_date).getTime() < Date.now()) return 'bg-red-400';
  return 'bg-amber-400';
}

/* ── History (audit trail + e-signatures) tab ── */
function TrailTab({ capaId }: { capaId: string }) {
  const { data: trailResp } = useAuditTrail('Capa', capaId);
  const { data: sigResp } = useSignatures('Capa', capaId);
  const signMut = useSignEntity();
  const trail = trailResp?.data ?? [];
  const signatures = sigResp?.data ?? [];

  const [signOpen, setSignOpen] = useState(false);
  const [meaning, setMeaning] = useState('Reviewed');
  const [credential, setCredential] = useState('');

  const sign = async () => {
    if (!credential) {
      message.error('Enter your signature PIN or password');
      return;
    }
    try {
      await signMut.mutateAsync({
        entity_type: 'Capa',
        entity_id: capaId,
        meaning,
        credential,
      });
      message.success('Signature recorded');
      setSignOpen(false);
      setCredential('');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Electronic Signatures</h3>
          <Button size="sm" variant="outline" onClick={() => setSignOpen(true)}>
            Sign
          </Button>
        </div>
        {signatures.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">No signatures yet</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {signatures.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-900">
                  <span className="font-medium">{s.meaning}</span> — {s.user_name}
                </span>
                <span className="text-xs text-gray-500">{new Date(s.signed_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Change History</h3>
        {trail.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">No history recorded</div>
        ) : (
          <ul className="space-y-2">
            {trail.map((t) => (
              <li key={t.id} className="flex items-start gap-3 text-sm">
                <span className="w-36 shrink-0 text-xs text-gray-400">
                  {new Date(t.created_at).toLocaleString()}
                </span>
                <span className="text-gray-800">
                  <span className="font-medium">{t.user_name}</span>{' '}
                  {t.action === 'TRANSITION' && t.field === 'status'
                    ? `changed status ${t.old_value ?? ''} → ${t.new_value ?? ''}`
                    : t.action === 'CREATE'
                      ? `created ${t.new_value ?? ''}`
                      : t.action === 'SIGN'
                        ? `signed: ${t.new_value ?? ''}`
                        : `${t.action.toLowerCase()} ${t.field ?? ''}`}
                  {t.reason ? <span className="text-gray-500"> — {t.reason}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AntModal
        title="Electronic Signature"
        open={signOpen}
        onCancel={() => setSignOpen(false)}
        onOk={sign}
        okText="Sign"
        okButtonProps={{ loading: signMut.isPending }}
      >
        <p className="mb-3 text-sm text-gray-600">
          Re-enter your credential to apply a 21 CFR Part 11 electronic signature. Use your signature
          PIN if enrolled, otherwise your account password.
        </p>
        <div className="space-y-3">
          <Labeled label="Meaning">
            <AntSelect
              value={meaning}
              onChange={setMeaning}
              options={['Reviewed', 'Approved', 'Verified & Closed', 'Acknowledged'].map((m) => ({
                value: m,
                label: m,
              }))}
              className="w-full"
            />
          </Labeled>
          <Labeled label="Signature PIN / password">
            <AntInput.Password
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder="••••••"
              onPressEnter={sign}
            />
          </Labeled>
        </div>
      </AntModal>
    </div>
  );
}

/* ── small helpers ── */
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm text-gray-900">{value}</div>
    </div>
  );
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-gray-600">{label}</label>
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
