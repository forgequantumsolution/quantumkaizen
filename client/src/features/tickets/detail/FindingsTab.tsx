import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Input, Select, DatePicker, Button as AntButton, message } from 'antd';
import { Plus, ShieldPlus, Pencil, Trash2, Sparkles, AlertTriangle } from 'lucide-react';
import { Card, DataTable, Button, EmptyState, type Column } from '@/components/ui';
import {
  useTicketFindings,
  useCreateFinding,
  useUpdateFinding,
  useDeleteFinding,
  useRaiseChild,
  type Finding,
  type FindingSeverity,
} from '@/lib/api/finding';
import { FindingSeverityBadge, FindingStatusBadge } from '@/features/audit/auditStatusBadge';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';

const SEVERITIES: FindingSeverity[] = ['OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL'];

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message ?? 'Something went wrong'
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[13px] font-medium text-gray-700 mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Manual add / edit finding ──
function FindingDrawer({
  ticketId,
  finding,
  open,
  onClose,
}: {
  ticketId: string;
  finding: Finding | null;
  open: boolean;
  onClose: () => void;
}) {
  const createMut = useCreateFinding();
  const updateMut = useUpdateFinding(finding?.id ?? '');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<FindingSeverity>('MAJOR');
  const [description, setDescription] = useState('');
  const [recommendation, setRecommendation] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(finding?.title ?? '');
      setSeverity(finding?.severity ?? 'MAJOR');
      setDescription(finding?.description ?? '');
      setRecommendation(finding?.recommendation ?? '');
    }
  }, [open, finding]);

  const submit = async () => {
    try {
      if (finding) {
        await updateMut.mutateAsync({ title, severity, description, recommendation });
        message.success('Finding updated');
      } else {
        await createMut.mutateAsync({
          source_ticket_id: ticketId,
          severity,
          title,
          description,
          recommendation: recommendation || null,
        });
        message.success('Finding added');
      }
      onClose();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Drawer
      title={finding ? `Edit ${finding.finding_number}` : 'Add finding'}
      width={460}
      open={open}
      onClose={onClose}
      destroyOnClose
      footer={
        <div className="flex items-center justify-end gap-2">
          <AntButton onClick={onClose}>Cancel</AntButton>
          <AntButton
            type="primary"
            loading={createMut.isPending || updateMut.isPending}
            onClick={submit}
          >
            {finding ? 'Save' : 'Add finding'}
          </AntButton>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
        </Field>
        <Field label="Severity" required>
          <Select
            value={severity}
            onChange={setSeverity}
            options={SEVERITIES.map((s) => ({ value: s, label: s }))}
            className="w-full"
          />
        </Field>
        <Field label="Description" required>
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={4000}
          />
        </Field>
        <Field label="Recommendation">
          <Input.TextArea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            rows={3}
            maxLength={4000}
          />
        </Field>
      </div>
    </Drawer>
  );
}

// ── Raise CAPA / Deviation from a finding ──
const CHILD_TYPES = [
  { value: 'CAPA', label: 'CAPA (Corrective & Preventive Action)' },
  { value: 'DEVIATION', label: 'Deviation' },
] as const;

function RaiseChildDrawer({ finding, onClose }: { finding: Finding | null; onClose: () => void }) {
  const nav = useNavigate();
  const raiseMut = useRaiseChild(finding?.id ?? '');
  const { data: usersData } = useUserDirectory();
  const { data: deptsResp } = useDepartments({ pageSize: 200 });
  const users = usersData?.items ?? [];
  const departments = deptsResp?.items ?? [];

  const [childType, setChildType] = useState<'CAPA' | 'DEVIATION'>('CAPA');
  const [title, setTitle] = useState('');
  const [capaType, setCapaType] = useState<'CORRECTIVE' | 'PREVENTIVE' | 'BOTH'>('CORRECTIVE');
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<string | undefined>();

  const seededFor = useMemo(() => finding?.id, [finding]);
  useEffect(() => {
    if (finding) {
      setChildType('CAPA');
      setTitle(`${finding.finding_number} — ${finding.title}`.slice(0, 200));
      setCapaType('CORRECTIVE');
      setOwnerId(undefined);
      setDepartmentId(finding.source_ticket?.department?.id);
      setDueDate(undefined);
    }
  }, [seededFor, finding]);

  const submit = async () => {
    if (!finding) return;
    try {
      const res = await raiseMut.mutateAsync({
        child_type: childType,
        title: title.trim() || undefined,
        owner_id: ownerId ?? null,
        department_id: departmentId ?? null,
        due_date: dueDate ?? null,
        ...(childType === 'CAPA' ? { capa_type: capaType } : {}),
      });
      message.success(`${childType === 'CAPA' ? 'CAPA' : 'Deviation'} raised`);
      onClose();
      const data = (res as { data?: Record<string, unknown> })?.data ?? res;
      if (childType === 'CAPA') {
        const capaId = (data as { capa?: { id?: string } })?.capa?.id;
        if (capaId) nav(`/audit/capa/${capaId}`);
      } else {
        const tid = (data as { ticket?: { ticketId?: string } })?.ticket?.ticketId;
        if (tid) nav(`/tickets/${tid}`);
      }
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Drawer
      title={finding ? `Raise from ${finding.finding_number}` : 'Raise child'}
      width={480}
      open={!!finding}
      onClose={onClose}
      destroyOnClose
      footer={
        <div className="flex items-center justify-end gap-2">
          <AntButton onClick={onClose}>Cancel</AntButton>
          <AntButton
            type="primary"
            icon={<ShieldPlus size={14} />}
            loading={raiseMut.isPending}
            onClick={submit}
          >
            Raise {childType === 'CAPA' ? 'CAPA' : 'Deviation'}
          </AntButton>
        </div>
      }
    >
      {finding && (
        <>
          <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 mb-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-amber-700">
                {finding.finding_number}
              </span>
              <FindingSeverityBadge severity={finding.severity} />
            </div>
            <p className="text-sm text-gray-800 mt-1.5 line-clamp-2">{finding.description}</p>
          </div>

          <div className="space-y-4">
            <Field label="Raise as" required>
              <Select
                value={childType}
                onChange={(v) => setChildType(v)}
                options={CHILD_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                className="w-full"
              />
            </Field>
            <Field label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </Field>
            {childType === 'CAPA' && (
              <Field label="CAPA type" required>
                <Select
                  value={capaType}
                  onChange={setCapaType}
                  options={['CORRECTIVE', 'PREVENTIVE', 'BOTH'].map((t) => ({
                    value: t,
                    label: t,
                  }))}
                  className="w-full"
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Owner">
                <Select
                  value={ownerId}
                  onChange={setOwnerId}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Assign owner"
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                  className="w-full"
                />
              </Field>
              <Field label="Department">
                <Select
                  value={departmentId}
                  onChange={setDepartmentId}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Owning dept."
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  className="w-full"
                />
              </Field>
            </div>
            <Field label="Due date">
              <DatePicker
                className="w-full"
                onChange={(d) => setDueDate(d ? d.toISOString() : undefined)}
              />
            </Field>
          </div>
        </>
      )}
    </Drawer>
  );
}

export default function FindingsTab({
  ticketId,
  canCreate,
}: {
  ticketId: string;
  canCreate: boolean;
}) {
  const { data, isLoading } = useTicketFindings(ticketId);
  const deleteMut = useDeleteFinding();
  const confirmDelete = useConfirmDelete();
  const findings = data?.data ?? [];

  const [raiseFor, setRaiseFor] = useState<Finding | null>(null);
  const [editFinding, setEditFinding] = useState<Finding | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openAdd = () => {
    setEditFinding(null);
    setDrawerOpen(true);
  };
  const openEdit = (f: Finding) => {
    setEditFinding(f);
    setDrawerOpen(true);
  };

  const columns: Column<Finding>[] = [
    {
      key: 'finding_number',
      header: 'Finding',
      render: (f) => <span className="font-mono text-xs font-semibold">{f.finding_number}</span>,
    },
    { key: 'severity', header: 'Severity', render: (f) => <FindingSeverityBadge severity={f.severity} /> },
    {
      key: 'title',
      header: 'Title',
      render: (f) => (
        <div className="max-w-md">
          <p className="text-sm text-gray-900 truncate">{f.title}</p>
          <p className="text-[11px] text-gray-400 truncate">{f.description}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (f) => <FindingStatusBadge status={f.status} /> },
    {
      key: 'source',
      header: 'Source',
      render: (f) =>
        f.is_generated ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-violet-600">
            <Sparkles size={11} /> Checklist
          </span>
        ) : (
          <span className="text-[11px] text-gray-400">Manual</span>
        ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (f) => (
        <div className="flex items-center gap-1.5">
          {canCreate && (
            <Button size="sm" variant="outline" onClick={() => setRaiseFor(f)}>
              <ShieldPlus size={13} />
              <span className="ml-1">Raise</span>
            </Button>
          )}
          {canCreate && (
            <button
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              title="Edit"
              onClick={() => openEdit(f)}
            >
              <Pencil size={14} />
            </button>
          )}
          {canCreate && (
            <button
              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Delete"
              onClick={() =>
                confirmDelete({
                  entityLabel: 'finding',
                  name: f.finding_number,
                  mutate: () => deleteMut.mutateAsync(f.id),
                  invalidateKey: ['findings'],
                })
              }
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Findings</h3>
          <p className="text-[11px] text-gray-400">
            Auto-generated from checklist dispositions; raise CAPA / Deviation to act on them.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} />
            <span className="ml-1">Add finding</span>
          </Button>
        )}
      </div>

      {!isLoading && findings.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No findings yet"
          description="Findings appear when a checklist with non-conformances is submitted, or you can add one manually."
        />
      ) : (
        <DataTable columns={columns} data={findings} isLoading={isLoading} />
      )}

      <RaiseChildDrawer finding={raiseFor} onClose={() => setRaiseFor(null)} />
      <FindingDrawer
        ticketId={ticketId}
        finding={editFinding}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Card>
  );
}
