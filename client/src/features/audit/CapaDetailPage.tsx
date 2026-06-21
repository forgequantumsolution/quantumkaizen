import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Modal, Select, Space, Spin, Table, Tabs, message } from 'antd';
import { ArrowLeft, Plus } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
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
  type CapaStatus,
  type CapaType,
  type CapaUpdate,
} from '@/lib/api/audit';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useHasPermission } from '@/stores/authStore';
import { ActionStatusBadge, ActionPriorityBadge, CapaStatusBadge, NcStatusBadge } from './auditStatusBadge';

const FLOW: CapaStatus[] = [
  'OPEN',
  'INVESTIGATION',
  'PLAN',
  'IMPLEMENTATION',
  'VERIFICATION',
  'CLOSED',
];
const TYPES: CapaType[] = ['CORRECTIVE', 'PREVENTIVE', 'BOTH'];
const ACTION_STATUSES: ActionItemStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED'];

export default function CapaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data, isLoading } = useCapa(id);
  const c = data?.data;
  const canUpdate = useHasPermission('capa.update');
  const statusMut = useUpdateCapaStatus();

  if (isLoading || !c) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const nextStatus = (() => {
    const i = FLOW.indexOf(c.status);
    return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
  })();

  const advance = async () => {
    if (!nextStatus) return;
    try {
      await statusMut.mutateAsync({ id: c.id, status: nextStatus });
      message.success(`CAPA moved to ${nextStatus.replace(/_/g, ' ')}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const closed = c.status === 'CLOSED' || c.status === 'CANCELLED';

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/audit/capa"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{c.capa_number}</span>
          <CapaStatusBadge status={c.status} />
        </div>
        {canUpdate && !closed && (
          <Space>
            {nextStatus && (
              <Button type="primary" onClick={advance} loading={statusMut.isPending}>
                Advance → {nextStatus.replace(/_/g, ' ')}
              </Button>
            )}
            <Button
              danger
              onClick={() =>
                statusMut.mutate({ id: c.id, status: 'CANCELLED' })
              }
            >
              Cancel CAPA
            </Button>
          </Space>
        )}
      </div>

      {/* Lifecycle stepper */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {FLOW.map((s, i) => {
            const active = FLOW.indexOf(c.status) >= i;
            return (
              <span key={s} className="flex items-center gap-1">
                <span
                  className={`px-2 py-0.5 rounded ${
                    active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s.replace(/_/g, ' ')}
                </span>
                {i < FLOW.length - 1 && <span className="text-gray-300">→</span>}
              </span>
            );
          })}
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">{c.title}</h2>

      <Tabs
        items={[
          { key: 'details', label: 'Details', children: <DetailsTab capa={c} canEdit={canUpdate && !closed} /> },
          { key: 'rca', label: 'Root Cause', children: <RcaTab capa={c} canEdit={canUpdate && !closed} /> },
          { key: 'actions', label: `Actions (${c.action_item_count})`, children: <ActionsTab capa={c} /> },
          { key: 'verify', label: 'Verification', children: <VerificationTab capa={c} canEdit={canUpdate} /> },
          { key: 'trail', label: 'Audit Trail', children: <TrailTab capaId={c.id} /> },
        ]}
      />
    </PageContainer>
  );
}

/* ── Details tab ── */
function DetailsTab({ capa, canEdit }: { capa: Capa; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex justify-end mb-2">
        {canEdit && <Button size="small" onClick={() => setOpen(true)}>Edit</Button>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
              <Link to="/audit/non-conformance" className="font-mono text-emerald-700 hover:underline">
                {capa.non_conformance.ncNumber}
              </Link>
            ) : (
              '—'
            )
          }
        />
      </div>
      {capa.non_conformance && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-gray-500 uppercase tracking-wide">From finding</span>
            <NcStatusBadge status={capa.non_conformance.status} />
          </div>
          <p className="text-gray-700">{capa.non_conformance.finding?.description ?? '—'}</p>
        </div>
      )}
      {capa.description && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Description</div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{capa.description}</p>
        </div>
      )}
      <EditCapaModal capa={capa} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function EditCapaModal({ capa, open, onClose }: { capa: Capa; open: boolean; onClose: () => void }) {
  const updateMut = useUpdateCapa(capa.id);
  const { data: usersData } = useAdminUsers({ pageSize: 200, isActive: true });
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
    <Modal title="Edit CAPA" open={open} onCancel={onClose} onOk={submit} okButtonProps={{ loading: updateMut.isPending }}>
      <div className="space-y-3">
        <Labeled label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Labeled>
        <Labeled label="Type">
          <Select value={type} onChange={setType} options={TYPES.map((t) => ({ value: t, label: t }))} className="w-full" />
        </Labeled>
        <Labeled label="Owner">
          <Select value={ownerId} onChange={setOwnerId} allowClear showSearch optionFilterProp="label"
            options={users.map((u) => ({ value: u.id, label: u.name }))} className="w-full" />
        </Labeled>
        <Labeled label="Department">
          <Select value={departmentId} onChange={setDepartmentId} allowClear showSearch optionFilterProp="label"
            options={departments.map((d) => ({ value: d.id, label: d.name }))} className="w-full" />
        </Labeled>
        <Labeled label="Due date">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Labeled>
        <Labeled label="Description">
          <Input.TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Labeled>
      </div>
    </Modal>
  );
}

/* ── Root cause tab ── */
function RcaTab({ capa, canEdit }: { capa: Capa; canEdit: boolean }) {
  const updateMut = useUpdateCapa(capa.id);
  const [rootCause, setRootCause] = useState(capa.root_cause ?? '');
  const [corrective, setCorrective] = useState(capa.corrective_action ?? '');
  const [preventive, setPreventive] = useState(capa.preventive_action ?? '');

  useEffect(() => {
    setRootCause(capa.root_cause ?? '');
    setCorrective(capa.corrective_action ?? '');
    setPreventive(capa.preventive_action ?? '');
  }, [capa]);

  const save = async () => {
    try {
      await updateMut.mutateAsync({
        root_cause: rootCause || null,
        corrective_action: corrective || null,
        preventive_action: preventive || null,
      });
      message.success('Saved');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <Labeled label="Root cause analysis">
        <Input.TextArea rows={4} value={rootCause} disabled={!canEdit}
          onChange={(e) => setRootCause(e.target.value)} placeholder="Why did this occur? (e.g. 5-Why)" />
      </Labeled>
      <Labeled label="Corrective action (fix the occurrence)">
        <Input.TextArea rows={3} value={corrective} disabled={!canEdit}
          onChange={(e) => setCorrective(e.target.value)} />
      </Labeled>
      <Labeled label="Preventive action (stop recurrence)">
        <Input.TextArea rows={3} value={preventive} disabled={!canEdit}
          onChange={(e) => setPreventive(e.target.value)} />
      </Labeled>
      {canEdit && (
        <div className="flex justify-end">
          <Button type="primary" onClick={save} loading={updateMut.isPending}>Save</Button>
        </div>
      )}
    </div>
  );
}

/* ── Actions tab ── */
function ActionsTab({ capa }: { capa: Capa }) {
  const { data } = useActionItems({ capa_id: capa.id });
  const rows = data?.data ?? [];
  const canCreate = useHasPermission('action_item.create');
  const canUpdate = useHasPermission('action_item.update');
  const createMut = useCreateActionItem();
  const statusMut = useUpdateActionItemStatus();
  const { data: usersData } = useAdminUsers({ pageSize: 200, isActive: true });
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Action items</h3>
        {canCreate && <Button size="small" icon={<Plus size={12} />} onClick={() => setOpen(true)}>Add action</Button>}
      </div>
      <Table<ActionItem>
        size="small"
        rowKey="id"
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: 'No action items yet' }}
        columns={[
          { title: 'Action #', dataIndex: 'action_number', width: 120, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Title', dataIndex: 'title', ellipsis: true },
          { title: 'Owner', width: 130, render: (_: unknown, r) => r.owner?.name ?? '—' },
          { title: 'Priority', dataIndex: 'priority', width: 100, render: (v: ActionItem['priority']) => <ActionPriorityBadge priority={v} /> },
          { title: 'Due', dataIndex: 'due_date', width: 110, render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—') },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 150,
            render: (v: ActionItemStatus, r) =>
              canUpdate ? (
                <Select
                  size="small"
                  value={v}
                  onChange={(s) => statusMut.mutate({ id: r.id, status: s })}
                  options={ACTION_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                  className="w-full"
                />
              ) : (
                <ActionStatusBadge status={v} />
              ),
          },
        ]}
      />

      <Modal title="Add action item" open={open} onCancel={() => setOpen(false)} onOk={add} okText="Add" okButtonProps={{ loading: createMut.isPending }}>
        <div className="space-y-3">
          <Labeled label="Title *"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Labeled>
          <Labeled label="Owner">
            <Select value={ownerId} onChange={setOwnerId} allowClear showSearch optionFilterProp="label"
              options={users.map((u) => ({ value: u.id, label: u.name }))} className="w-full" />
          </Labeled>
          <Labeled label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Labeled>
        </div>
      </Modal>
    </div>
  );
}

/* ── Verification tab ── */
function VerificationTab({ capa, canEdit }: { capa: Capa; canEdit: boolean }) {
  const updateMut = useUpdateCapa(capa.id);
  const statusMut = useUpdateCapaStatus();
  const [text, setText] = useState(capa.effectiveness_check ?? '');

  useEffect(() => setText(capa.effectiveness_check ?? ''), [capa]);

  const save = async () => {
    try {
      await updateMut.mutateAsync({ effectiveness_check: text || null });
      message.success('Saved');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const verifyAndClose = async () => {
    try {
      if (text !== (capa.effectiveness_check ?? '')) {
        await updateMut.mutateAsync({ effectiveness_check: text || null });
      }
      await statusMut.mutateAsync({ id: capa.id, status: 'CLOSED' });
      message.success('CAPA verified & closed — source NC updated');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const closed = capa.status === 'CLOSED' || capa.status === 'CANCELLED';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <Labeled label="Effectiveness check">
        <Input.TextArea
          rows={4}
          value={text}
          disabled={!canEdit || closed}
          onChange={(e) => setText(e.target.value)}
          placeholder="How was the action verified to be effective?"
        />
      </Labeled>
      {capa.verified_by && (
        <div className="text-xs text-gray-500">
          Verified by {capa.verified_by.name}
          {capa.verified_at ? ` on ${new Date(capa.verified_at).toLocaleString()}` : ''}
        </div>
      )}
      {capa.closed_at && (
        <div className="text-xs text-emerald-700">Closed {new Date(capa.closed_at).toLocaleString()}</div>
      )}
      {canEdit && !closed && (
        <div className="flex justify-end gap-2">
          <Button onClick={save} loading={updateMut.isPending}>Save</Button>
          <Button type="primary" onClick={verifyAndClose} loading={statusMut.isPending}>
            Verify &amp; Close
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Audit trail + e-signatures tab ── */
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
      {/* E-signatures */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Electronic Signatures</h3>
          <Button size="small" onClick={() => setSignOpen(true)}>
            Sign
          </Button>
        </div>
        {signatures.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">No signatures yet</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {signatures.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-gray-900">
                  <span className="font-medium">{s.meaning}</span> — {s.user_name}
                </span>
                <span className="text-xs text-gray-500">{new Date(s.signed_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Immutable trail */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Change History</h3>
        {trail.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">No history recorded</div>
        ) : (
          <ul className="space-y-2">
            {trail.map((t) => (
              <li key={t.id} className="text-sm flex items-start gap-3">
                <span className="text-xs text-gray-400 shrink-0 w-36">
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
      </div>

      <Modal
        title="Electronic Signature"
        open={signOpen}
        onCancel={() => setSignOpen(false)}
        onOk={sign}
        okText="Sign"
        okButtonProps={{ loading: signMut.isPending }}
      >
        <p className="text-sm text-gray-600 mb-3">
          Re-enter your credential to apply a 21 CFR Part 11 electronic signature. Use your signature
          PIN if enrolled, otherwise your account password.
        </p>
        <div className="space-y-3">
          <Labeled label="Meaning">
            <Select
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
            <Input.Password
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder="••••••"
              onPressEnter={sign}
            />
          </Labeled>
        </div>
      </Modal>
    </div>
  );
}

/* ── small helpers ── */
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
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
