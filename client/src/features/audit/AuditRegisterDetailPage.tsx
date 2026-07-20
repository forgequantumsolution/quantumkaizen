import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Modal, Spin, message } from 'antd';
import { ArrowLeft, Edit3, Send, Check, X, PlayCircle, FileText, GitBranch, ExternalLink } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import {
  useApproveAuditRegister,
  useAuditRegister,
  useRejectAuditRegister,
  useSubmitAuditRegister,
  useDeleteAuditRegister,
} from '@/lib/api/audit';
import { useTicket } from '@/lib/api/ticket';
import { useHasPermission } from '@/stores/authStore';
import { AuditStatusBadge } from './auditStatusBadge';

export default function AuditRegisterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data, isLoading } = useAuditRegister(id);
  const r = data?.data;

  const canApprove = useHasPermission('audit_register.approve');
  const canUpdate = useHasPermission('audit_register.update');
  const canDelete = useHasPermission('audit_register.delete');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const submitMut = useSubmitAuditRegister();
  const approveMut = useApproveAuditRegister();
  const rejectMut = useRejectAuditRegister();
  const deleteMut = useDeleteAuditRegister();

  if (isLoading || !r) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const handleSubmit = async () => {
    try {
      await submitMut.mutateAsync(r.id);
      message.success('Submitted for approval');
    } catch (err) {
      message.error(extractErr(err));
    }
  };
  const handleApprove = async () => {
    try {
      await approveMut.mutateAsync(r.id);
      message.success('Register approved — audit program created');
    } catch (err) {
      message.error(extractErr(err));
    }
  };
  const handleReject = async () => {
    if (!rejectReason.trim()) return message.error('Rejection reason is required');
    try {
      await rejectMut.mutateAsync({ id: r.id, reason: rejectReason });
      setRejectOpen(false);
      setRejectReason('');
      message.success('Register rejected');
    } catch (err) {
      message.error(extractErr(err));
    }
  };
  const handleDelete = async () => {
    if (!confirm(`Delete ${r.register_number}?`)) return;
    try {
      await deleteMut.mutateAsync(r.id);
      message.success('Deleted');
      nav('/audit/register');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const isEditable = r.status === 'DRAFT' || r.status === 'REJECTED';
  const canSubmit = isEditable && !!r.approver;

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/audit/register"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{r.register_number}</span>
          <AuditStatusBadge status={r.status} />
        </div>
        <div className="flex items-center gap-2">
          {isEditable && canUpdate && (
            <Button icon={<Edit3 size={14} />} onClick={() => nav(`/audit/register/${r.id}/edit`)}>
              Edit
            </Button>
          )}
          {canSubmit && canUpdate && (
            <Button
              type="primary"
              icon={<Send size={14} />}
              onClick={handleSubmit}
              loading={submitMut.isPending}
            >
              Submit for Approval
            </Button>
          )}
          {r.status === 'PENDING_APPROVAL' && canApprove && (
            <>
              <Button
                icon={<X size={14} />}
                danger
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
              <Button
                type="primary"
                icon={<Check size={14} />}
                onClick={handleApprove}
                loading={approveMut.isPending}
              >
                Approve
              </Button>
            </>
          )}
          {r.status === 'APPROVED' && r.program && (
            <Button
              type="primary"
              icon={<PlayCircle size={14} />}
              onClick={() => nav(`/audit/program/${r.program!.id}`)}
            >
              Open Program
            </Button>
          )}
          <Button icon={<FileText size={14} />} onClick={() => nav(`/audit/register/${r.id}/report`)}>
            Report
          </Button>
          {isEditable && canDelete && (
            <Button danger onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{r.title}</h2>
        {r.description && (
          <p className="text-sm text-gray-600 mb-3">{r.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Audit Type" value={r.audit_type.replace(/_/g, ' ')} />
          <Field
            label="Audit Master"
            value={
              r.audit_master
                ? r.audit_master.code
                  ? `${r.audit_master.code} — ${r.audit_master.name}`
                  : r.audit_master.name
                : '—'
            }
          />
          <Field
            label="Planned Date"
            value={r.planned_date ? new Date(r.planned_date).toLocaleDateString() : '—'}
          />
          <Field label="Financial Year" value={r.financial_year ?? '—'} />
          <Field label="Plant" value={r.plant ?? '—'} />
          <Field label="Method" value={r.audit_method ?? '—'} />
          <Field label="Lead Auditor" value={r.auditor?.name ?? '—'} />
          <Field label="Approver" value={r.approver?.name ?? '—'} />
          <Field
            label="Focus Areas"
            value={r.focus_areas.length ? r.focus_areas.map((f) => f.name).join(', ') : '—'}
          />
          <Field
            label="Team Members"
            value={r.team_members.length ? r.team_members.map((m) => m.name).join(', ') : '—'}
          />
        </div>

        {r.checklist_assignments.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Checklist Assignments</h3>
            <ul className="space-y-1.5 text-sm">
              {r.checklist_assignments.map((a) => (
                <li key={a.checklist_form_id} className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="font-medium text-gray-800">{a.checklist_title}:</span>
                  <span className="text-gray-600">
                    {a.members.length ? a.members.map((m) => m.name).join(', ') : 'Unassigned'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(r.submitted_at || r.approved_at || r.rejection_reason) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Approval Timeline</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            {r.submitted_at && (
              <li>
                <span className="text-gray-500">Submitted:</span>{' '}
                {new Date(r.submitted_at).toLocaleString()}
              </li>
            )}
            {r.approved_at && (
              <li>
                <span className="text-gray-500">
                  {r.status === 'REJECTED' ? 'Rejected' : 'Approved'} by:
                </span>{' '}
                {r.approved_by?.name ?? '—'} on{' '}
                {new Date(r.approved_at).toLocaleString()}
              </li>
            )}
            {r.rejection_reason && (
              <li className="text-red-700">
                <span className="text-gray-500">Reason:</span> {r.rejection_reason}
              </li>
            )}
          </ul>
        </div>
      )}

      {r.program && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Linked Program</h3>
          <Link
            to={`/audit/program/${r.program.id}`}
            className="text-blue-600 hover:underline font-mono"
          >
            {r.program.programNumber}
          </Link>{' '}
          <span className="text-xs text-gray-500 ml-2">({r.program.status})</span>
        </div>
      )}

      {r.workflow_ticket_id && (
        <WorkflowProgressCard
          ticketId={r.workflow_ticket_id}
          uniqueId={r.workflow_ticket_unique_id}
        />
      )}

      {r.checklist_form && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <FileText size={14} className="text-gray-500" />
                Audit Checklist
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{r.checklist_form.title}</p>
            </div>
            <Button
              type="primary"
              icon={<FileText size={14} />}
              onClick={() => nav(`/forms/${r.checklist_form!.id}/fill`)}
            >
              Fill Audit Checklist
            </Button>
          </div>
        </div>
      )}

      <Modal
        title="Reject Audit Register"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={handleReject}
        okText="Reject"
        okButtonProps={{ danger: true, loading: rejectMut.isPending }}
      >
        <p className="text-sm text-gray-600 mb-2">
          Please provide a reason for rejecting this audit register. It will be
          visible to the creator.
        </p>
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason…"
        />
      </Modal>
    </PageContainer>
  );
}

function WorkflowProgressCard({
  ticketId,
  uniqueId,
}: {
  ticketId: string;
  uniqueId: string | null;
}) {
  const { data: ticket, isLoading } = useTicket(ticketId);
  const flow = ticket?.flows?.[0];
  const currentStages = flow?.currentStages ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <GitBranch size={14} className="text-gray-500" />
          Audit Workflow
        </h3>
        <Link
          to={`/tickets/${ticketId}`}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          Open in workflow <ExternalLink size={12} />
        </Link>
      </div>
      {isLoading ? (
        <Spin size="small" />
      ) : ticket ? (
        <div className="text-sm">
          <div className="text-gray-700">
            <span className="font-mono text-gray-500">{uniqueId ?? ticket.uniqueId}</span>
            {flow ? (
              <span className="text-xs text-gray-500 ml-2">
                {flow.workflowName} · v{flow.workflowVersion}
                {flow.isRejected ? ' · rejected' : flow.isCompleted ? ' · completed' : ''}
              </span>
            ) : null}
          </div>
          <div className="mt-2">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">
              Current stage{currentStages.length === 1 ? '' : 's'}
            </div>
            {currentStages.length === 0 ? (
              <span className="text-xs text-gray-400">
                {flow?.isRejected ? 'Workflow rejected' : flow?.isCompleted ? 'Workflow complete' : '—'}
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {currentStages.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center px-2 py-0.5 text-xs rounded border bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            The stage checklist and full progress live on the workflow ticket.
          </p>
        </div>
      ) : (
        <span className="text-xs text-gray-400">Workflow ticket not found.</span>
      )}
    </div>
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

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message ?? 'Operation failed'
  );
}
