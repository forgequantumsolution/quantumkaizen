import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Drawer, Input, Modal, Select, Space, Spin, message } from 'antd';
import { DataTable } from '@/components/ui';
import { ArrowLeft, CheckCircle, PlayCircle, Plus, Trash2, Edit3, Info } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import {
  useAuditProgram,
  useCompleteAuditProgram,
  useCreateFinding,
  useDeleteFinding,
  useUpdateFinding,
  usePromoteFindingToNc,
  useStartAuditProgram,
  type AuditFinding,
  type FindingSeverity,
  type FindingStatus,
  type FindingUpsert,
} from '@/lib/api/audit';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useHasPermission } from '@/stores/authStore';
import {
  FindingSeverityBadge,
  FindingStatusBadge,
  ProgramStatusBadge,
} from './auditStatusBadge';

const SEVERITIES: FindingSeverity[] = ['OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL'];
const FINDING_STATUSES: FindingStatus[] = [
  'OPEN',
  'IN_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'CLOSED',
];

export default function AuditProgramExecutionPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data, isLoading } = useAuditProgram(id);
  const p = data?.data;

  const canExecute = useHasPermission('audit_program.execute');
  const canFindingCreate = useHasPermission('audit_finding.create');
  const canFindingUpdate = useHasPermission('audit_finding.update');
  const canFindingDelete = useHasPermission('audit_finding.delete');
  const canNcCreate = useHasPermission('non_conformance.create');

  const startMut = useStartAuditProgram();
  const completeMut = useCompleteAuditProgram();

  const [findingDrawerOpen, setFindingDrawerOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<AuditFinding | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [score, setScore] = useState<string>('');

  if (isLoading || !p) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const handleStart = async () => {
    try {
      await startMut.mutateAsync(p.id);
      message.success('Audit program started');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const handleComplete = async () => {
    try {
      await completeMut.mutateAsync({
        id: p.id,
        summary: summary || null,
        score: score ? Number(score) : null,
      });
      setCompleteOpen(false);
      message.success('Audit program completed');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const findings = p.findings ?? [];
  const sevCounts = { CRITICAL: 0, MAJOR: 0, MINOR: 0, OBSERVATION: 0 };
  for (const f of findings) {
    const k = f.severity as keyof typeof sevCounts;
    if (k in sevCounts) sevCounts[k] += 1;
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/audit/program"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{p.program_number}</span>
          <ProgramStatusBadge status={p.status} />
        </div>
        <div className="flex items-center gap-2">
          {p.status === 'PLANNED' && canExecute && (
            <Button
              type="primary"
              icon={<PlayCircle size={14} />}
              onClick={handleStart}
              loading={startMut.isPending}
            >
              Start Audit
            </Button>
          )}
          {p.status === 'IN_PROGRESS' && canExecute && (
            <Button
              type="primary"
              icon={<CheckCircle size={14} />}
              onClick={() => setCompleteOpen(true)}
            >
              Complete Audit
            </Button>
          )}
        </div>
      </div>

      {/* Program summary — key facts only; full details live in the drawer. */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {p.register.title}
            </h2>
            <div className="text-[11px] text-gray-500 font-mono mt-0.5">
              Register {p.register.register_number}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3">
              <Fact label="Type" value={p.register.audit_type.replace(/_/g, ' ')} />
              <Fact label="Auditor" value={p.register.auditor?.name ?? '—'} />
              <Fact
                label="Planned"
                value={
                  p.register.planned_date
                    ? new Date(p.register.planned_date).toLocaleDateString()
                    : '—'
                }
              />
              {p.score != null && <Fact label="Score" value={String(p.score)} />}
            </div>
          </div>
          <Button icon={<Info size={14} />} onClick={() => setDetailsOpen(true)}>
            View details
          </Button>
        </div>

        {/* Findings overview — the core of "tracking the audit". */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <StatChip label="Findings" value={findings.length} tone="slate" />
          <StatChip label="Critical" value={sevCounts.CRITICAL} tone="red" />
          <StatChip label="Major" value={sevCounts.MAJOR} tone="amber" />
          <StatChip label="Minor" value={sevCounts.MINOR} tone="blue" />
          <StatChip label="Observation" value={sevCounts.OBSERVATION} tone="gray" />
        </div>
      </div>

      {/* Full audit details — moved out of the main view into a drawer. */}
      <Drawer
        title="Audit details"
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        width={440}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Audit Type" value={p.register.audit_type.replace(/_/g, ' ')} />
            <Field label="Auditor" value={p.register.auditor?.name ?? '—'} />
            <Field
              label="Planned"
              value={
                p.register.planned_date
                  ? new Date(p.register.planned_date).toLocaleDateString()
                  : '—'
              }
            />
            <Field label="Plant" value={p.register.plant ?? '—'} />
            <Field label="Checklist" value={p.register.checklist_form?.title ?? '—'} />
            <Field
              label="Started"
              value={p.started_at ? new Date(p.started_at).toLocaleString() : '—'}
            />
            <Field
              label="Completed"
              value={p.completed_at ? new Date(p.completed_at).toLocaleString() : '—'}
            />
            <Field label="Score" value={p.score == null ? '—' : String(p.score)} />
          </div>
          {p.summary && (
            <div className="pt-3 border-t border-gray-100">
              <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">
                Summary
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap gmp-narrative">
                {p.summary}
              </p>
            </div>
          )}
          {p.register.checklist_form && p.status !== 'PLANNED' && (
            <Button
              block
              onClick={() => nav(`/forms/${p.register.checklist_form!.id}/fill`)}
            >
              Open Checklist Form
            </Button>
          )}
        </div>
      </Drawer>

      {/* Findings */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Findings ({p.findings?.length ?? 0})
          </h3>
          {p.status === 'IN_PROGRESS' && canFindingCreate && (
            <Button
              icon={<Plus size={14} />}
              onClick={() => {
                setEditingFinding(null);
                setFindingDrawerOpen(true);
              }}
            >
              Add Finding
            </Button>
          )}
        </div>
        <FindingsTable
          findings={p.findings ?? []}
          canEdit={canFindingUpdate && p.status === 'IN_PROGRESS'}
          canDelete={canFindingDelete && p.status === 'IN_PROGRESS'}
          canPromote={canNcCreate}
          onEdit={(f) => {
            setEditingFinding(f);
            setFindingDrawerOpen(true);
          }}
        />
      </div>

      <FindingDrawer
        open={findingDrawerOpen}
        onClose={() => setFindingDrawerOpen(false)}
        programId={p.id}
        finding={editingFinding}
      />

      <Modal
        title="Complete Audit Program"
        open={completeOpen}
        onCancel={() => setCompleteOpen(false)}
        onOk={handleComplete}
        okText="Complete"
        okButtonProps={{ loading: completeMut.isPending }}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Summary
            </label>
            <Input.TextArea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Audit conclusions, key observations…"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Score (optional)
            </label>
            <Input
              type="number"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. 87.5"
            />
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

/* ─── Findings table ─── */

function FindingsTable({
  findings,
  canEdit,
  canDelete,
  canPromote,
  onEdit,
}: {
  findings: AuditFinding[];
  canEdit: boolean;
  canDelete: boolean;
  canPromote: boolean;
  onEdit: (f: AuditFinding) => void;
}) {
  const deleteMut = useDeleteFinding();
  const promoteMut = usePromoteFindingToNc();
  const { data: deptsResp } = useDepartments({ pageSize: 200 });
  const departments = deptsResp?.items ?? [];
  const [promoting, setPromoting] = useState<AuditFinding | null>(null);
  const [track, setTrack] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>();

  const handleDelete = async (f: AuditFinding) => {
    if (!confirm(`Delete finding ${f.finding_number}?`)) return;
    try {
      await deleteMut.mutateAsync(f.id);
      message.success('Finding deleted');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const handlePromote = async () => {
    if (!promoting) return;
    try {
      await promoteMut.mutateAsync({
        findingId: promoting.id,
        track: track || null,
        department_id: departmentId ?? null,
      });
      message.success('Non-conformance raised');
      setPromoting(null);
      setTrack('');
      setDepartmentId(undefined);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  if (findings.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        No findings recorded yet.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <DataTable<AuditFinding>
          data={findings}
          pageSize={1000}
          emptyMessage="No findings recorded yet."
          columns={[
            {
              key: 'finding_number',
              header: 'Finding #',
              render: (r) => <span className="font-mono text-blue-600">{r.finding_number}</span>,
            },
            {
              key: 'severity',
              header: 'Severity',
              sortable: false,
              render: (r) => <FindingSeverityBadge severity={r.severity as FindingSeverity} />,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: false,
              render: (r) => <FindingStatusBadge status={r.status as FindingStatus} />,
            },
            {
              key: 'clause_ref',
              header: 'Clause',
              sortable: false,
              render: (r) => r.clause_ref || r.iso_sub_clause?.subClauseNumber || '—',
            },
            { key: 'description', header: 'Description' },
            {
              key: 'nc',
              header: 'NC',
              sortable: false,
              render: (r) =>
                r.non_conformance ? (
                  <Link
                    to="/audit/non-conformance"
                    className="font-mono text-emerald-700 hover:underline"
                  >
                    {r.non_conformance.ncNumber}
                  </Link>
                ) : (
                  '—'
                ),
            },
            {
              key: 'actions',
              header: 'Actions',
              sortable: false,
              render: (r) => (
                <Space size={4}>
                  {canEdit && (
                    <Button
                      size="small"
                      icon={<Edit3 size={12} />}
                      onClick={() => onEdit(r)}
                    />
                  )}
                  {canPromote &&
                    !r.non_conformance &&
                    r.severity !== 'OBSERVATION' && (
                      <Button size="small" onClick={() => setPromoting(r)}>
                        Promote → NC
                      </Button>
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
      </div>

      <Modal
        title={`Promote ${promoting?.finding_number ?? ''} to Non-Conformance`}
        open={!!promoting}
        onCancel={() => setPromoting(null)}
        onOk={handlePromote}
        okText="Raise NC"
        okButtonProps={{ loading: promoteMut.isPending }}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Track (e.g. by-department, by-auditor)
            </label>
            <Input
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              placeholder="Optional track tag"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Department
            </label>
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              allowClear
              showSearch
              optionFilterProp="label"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              className="w-full"
              placeholder="Optional"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ─── Finding create / edit drawer ─── */

function FindingDrawer({
  open,
  onClose,
  programId,
  finding,
}: {
  open: boolean;
  onClose: () => void;
  programId: string;
  finding: AuditFinding | null;
}) {
  const [severity, setSeverity] = useState<FindingSeverity>(finding?.severity ?? 'MINOR');
  const [status, setStatus] = useState<FindingStatus>(finding?.status ?? 'OPEN');
  const [description, setDescription] = useState(finding?.description ?? '');
  const [clauseRef, setClauseRef] = useState(finding?.clause_ref ?? '');
  const [recommendation, setRecommendation] = useState(finding?.recommendation ?? '');

  useEffect(() => {
    if (open) {
      setSeverity(finding?.severity ?? 'MINOR');
      setStatus(finding?.status ?? 'OPEN');
      setDescription(finding?.description ?? '');
      setClauseRef(finding?.clause_ref ?? '');
      setRecommendation(finding?.recommendation ?? '');
    }
  }, [open, finding]);

  const createMut = useCreateFinding();
  const updateMut = useUpdateFinding(finding?.id ?? '');

  const submit = async () => {
    if (!description.trim()) {
      message.error('Description is required');
      return;
    }
    const body: FindingUpsert = {
      program_id: programId,
      severity,
      status,
      description: description.trim(),
      clause_ref: clauseRef || null,
      recommendation: recommendation || null,
    };
    try {
      if (finding) {
        await updateMut.mutateAsync(body);
        message.success('Finding updated');
      } else {
        await createMut.mutateAsync(body);
        message.success('Finding recorded');
      }
      onClose();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Drawer
      title={finding ? `Edit ${finding.finding_number}` : 'New Finding'}
      open={open}
      onClose={onClose}
      width={480}
      destroyOnClose
      footer={
        <Space className="flex justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            onClick={submit}
            loading={createMut.isPending || updateMut.isPending}
          >
            {finding ? 'Save' : 'Add Finding'}
          </Button>
        </Space>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field2 label="Severity *">
            <Select
              value={severity}
              onChange={setSeverity}
              options={SEVERITIES.map((s) => ({ value: s, label: s }))}
              className="w-full"
            />
          </Field2>
          <Field2 label="Status">
            <Select
              value={status}
              onChange={setStatus}
              options={FINDING_STATUSES.map((s) => ({ value: s, label: s }))}
              className="w-full"
            />
          </Field2>
        </div>
        <Field2 label="Clause Reference">
          <Input
            value={clauseRef}
            onChange={(e) => setClauseRef(e.target.value)}
            placeholder="e.g. 8.5.1"
          />
        </Field2>
        <Field2 label="Description *">
          <Input.TextArea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field2>
        <Field2 label="Recommendation">
          <Input.TextArea
            rows={3}
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
          />
        </Field2>
      </div>
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}

// Inline key fact used in the compact summary strip.
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

const STAT_TONES = {
  slate: 'bg-slate-50 text-slate-700 ring-slate-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  gray: 'bg-gray-50 text-gray-600 ring-gray-200',
} as const;

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${STAT_TONES[tone]}`}
    >
      <span className="font-bold tabular-nums">{value}</span>
      {label}
    </span>
  );
}

function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">
        {label}
      </label>
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
