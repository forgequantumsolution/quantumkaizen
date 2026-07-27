import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { App, Button, Input, Modal, Spin } from 'antd';
import {
  ArrowLeft, Edit3, GitBranch, Archive, Trash2, FileText, Send, X, ShieldCheck, CalendarCheck, Printer,
} from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useDocument,
  useSubmitDocument,
  useApproveDocument,
  useRejectDocument,
  useReviseDocument,
  useRetireDocument,
  useDeleteDocument,
  useMarkReviewed,
  DOC_TYPE_LABELS,
} from '@/lib/api/dms';
import RichTextEditor from './RichTextEditor';
import EntityAuditTrail from '@/components/shared/EntityAuditTrail';
import RiskLinkPanel from '@/components/risk/RiskLinkPanel';
import RiskProfileChip from '@/components/risk/RiskProfileChip';
import DocFileViewer from './DocFileViewer';
import DocStatusBadge from './DocStatusBadge';
import AcknowledgementPanel from './AcknowledgementPanel';
import { printDocument } from './printDocument';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { modal, message } = App.useApp();

  const { data: doc, isLoading } = useDocument(id);

  const canEdit = useHasPermission('document.update');
  const canApprove = useHasPermission('document.approve');
  const canIssue = useHasPermission('document.issue');
  const canDelete = useHasPermission('document.delete');

  const submitMut = useSubmitDocument(id ?? '');
  const approveMut = useApproveDocument(id ?? '');
  const rejectMut = useRejectDocument(id ?? '');
  const reviseMut = useReviseDocument(id ?? '');
  const retireMut = useRetireDocument(id ?? '');
  const reviewMut = useMarkReviewed(id ?? '');
  const deleteMut = useDeleteDocument();

  const [approveOpen, setApproveOpen] = useState(false);
  const [credential, setCredential] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (isLoading || !doc) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32"><Spin /></div>
      </PageContainer>
    );
  }

  const working = doc.working_version;
  const view = doc.current_version ?? doc.working_version;

  const reviewDueMs = doc.review_due_date ? new Date(doc.review_due_date).getTime() : null;
  const reviewState: 'overdue' | 'soon' | null =
    doc.status === 'EFFECTIVE' && reviewDueMs !== null
      ? reviewDueMs <= Date.now()
        ? 'overdue'
        : reviewDueMs <= Date.now() + 30 * 864e5
          ? 'soon'
          : null
      : null;

  const handleSubmit = () =>
    modal.confirm({
      title: 'Submit for review?',
      content: 'The document will be routed for approval. You can still revise after rejection.',
      okText: 'Submit',
      centered: true,
      onOk: async () => {
        try { await submitMut.mutateAsync(); message.success('Submitted for review'); }
        catch (e) { message.error(extractErr(e)); }
      },
    });

  const handleApprove = async () => {
    if (!credential.trim()) return message.error('Enter your signature credential');
    try {
      await approveMut.mutateAsync({ credential });
      setApproveOpen(false);
      setCredential('');
      message.success('Approved & made effective');
    } catch (e) { message.error(extractErr(e)); }
  };

  const handleReject = async () => {
    if (!reason.trim()) return message.error('A reason is required');
    try {
      await rejectMut.mutateAsync({ reason });
      setRejectOpen(false);
      setReason('');
      message.success('Returned to draft');
    } catch (e) { message.error(extractErr(e)); }
  };

  const handleRevise = async () => {
    try { await reviseMut.mutateAsync({}); message.success('New draft revision started'); nav(`/dms/${doc.id}/edit`); }
    catch (e) { message.error(extractErr(e)); }
  };

  const handleMarkReviewed = () =>
    modal.confirm({
      title: 'Mark periodic review complete?',
      content: 'Resets the next review due date 12 months out and records it on the audit trail.',
      okText: 'Mark Reviewed',
      centered: true,
      onOk: async () => {
        try { await reviewMut.mutateAsync({}); message.success('Periodic review recorded'); }
        catch (e) { message.error(extractErr(e)); }
      },
    });

  const handleRetire = () =>
    modal.confirm({
      title: 'Retire this document?',
      content: 'Retired documents are no longer effective but are retained for the record.',
      okText: 'Retire', okButtonProps: { danger: true }, centered: true,
      onOk: async () => {
        try { await retireMut.mutateAsync(); message.success('Document retired'); }
        catch (e) { message.error(extractErr(e)); }
      },
    });

  const handleDelete = () =>
    modal.confirm({
      title: `Delete ${doc.doc_number}?`,
      content: 'Only draft documents can be deleted. This cannot be undone.',
      okText: 'Delete', okButtonProps: { danger: true }, centered: true,
      onOk: async () => {
        try { await deleteMut.mutateAsync(doc.id); message.success('Deleted'); nav('/dms'); }
        catch (e) { message.error(extractErr(e)); }
      },
    });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/dms" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft size={14} /> Back
          </Link>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{doc.doc_number}</span>
          <DocStatusBadge status={doc.status} />
          {/* Self-hiding: only documents carrying linked risk show a chip. */}
          <RiskProfileChip entityType="Document" entityId={doc.id} showCount />
        </div>
        <div className="flex items-center gap-2">
          {view?.content_type === 'EDITOR' && view?.content && (
            <Button
              icon={<Printer size={14} />}
              onClick={() =>
                printDocument({
                  docNumber: doc.doc_number,
                  title: doc.title,
                  type: DOC_TYPE_LABELS[doc.type],
                  versionLabel: view.version_label,
                  effectiveDate: doc.effective_date,
                  html: view.content ?? '',
                })
              }
            >
              Print / PDF
            </Button>
          )}
          {canEdit && working && doc.status === 'DRAFT' && (
            <Button icon={<Edit3 size={14} />} onClick={() => nav(`/dms/${doc.id}/edit`)}>Edit Draft</Button>
          )}
          {canEdit && working && doc.status === 'DRAFT' && (
            <Button type="primary" icon={<Send size={14} />} onClick={handleSubmit} loading={submitMut.isPending}>
              Submit for Review
            </Button>
          )}
          {doc.status === 'IN_REVIEW' && canApprove && (
            <>
              <Button icon={<X size={14} />} danger onClick={() => setRejectOpen(true)}>Reject</Button>
              <Button type="primary" icon={<ShieldCheck size={14} />} onClick={() => setApproveOpen(true)}>
                Approve &amp; Sign
              </Button>
            </>
          )}
          {canEdit && doc.status === 'EFFECTIVE' && !working && (
            <Button icon={<GitBranch size={14} />} onClick={handleRevise} loading={reviseMut.isPending}>Revise</Button>
          )}
          {canIssue && doc.status === 'EFFECTIVE' && (
            <Button
              icon={<CalendarCheck size={14} />}
              onClick={handleMarkReviewed}
              loading={reviewMut.isPending}
            >
              Mark Reviewed
            </Button>
          )}
          {canIssue && (doc.status === 'EFFECTIVE' || doc.status === 'APPROVED') && (
            <Button icon={<Archive size={14} />} onClick={handleRetire}>Retire</Button>
          )}
          {canDelete && doc.status === 'DRAFT' && (
            <Button danger icon={<Trash2 size={14} />} onClick={handleDelete}>Delete</Button>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <FileText size={18} className="text-gray-400" />
          {doc.title}
        </h2>
        {doc.description && <p className="text-sm text-gray-600 mb-3">{doc.description}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Type" value={DOC_TYPE_LABELS[doc.type]} />
          <Field label="Owner" value={doc.owner_name ?? '—'} />
          <Field label="Department" value={doc.department_name ?? '—'} />
          <Field label="Effective Version" value={view?.version_label ?? '—'} />
          <Field label="Effective Date" value={doc.effective_date ? new Date(doc.effective_date).toLocaleDateString() : '—'} />
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">Review Due</div>
            <div className="text-sm text-gray-900 mt-0.5 flex items-center gap-1.5">
              {doc.review_due_date ? new Date(doc.review_due_date).toLocaleDateString() : '—'}
              {reviewState && (
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                    reviewState === 'overdue'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {reviewState === 'overdue' ? 'Overdue' : 'Due soon'}
                </span>
              )}
            </div>
          </div>
          <Field label="Format" value={view?.content_type === 'FILE' ? 'Uploaded file' : 'Online editor'} />
        </div>
      </div>

      {/* Controlled distribution — read & understood (effective docs only) */}
      {doc.status === 'EFFECTIVE' && <AcknowledgementPanel documentId={doc.id} canAssign={canIssue} />}

      {/* Risks this document is linked to. Self-hiding when there are none, so
          documents outside the risk chain are unaffected. */}
      <RiskLinkPanel entityType="Document" entityId={doc.id} className="mb-4" />


      {/* Content viewer */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">
          Document Content {view ? `· v${view.version_label}` : ''}
        </div>
        {!view ? (
          <div className="py-8 text-center text-sm text-gray-400">No content yet.</div>
        ) : view.content_type === 'FILE' ? (
          <DocFileViewer fileName={view.file_name} fileMime={view.file_mime} fileSize={view.file_size} fileData={view.file_data} />
        ) : view.content ? (
          <RichTextEditor key={view.id} value={view.content} editable={false} />
        ) : (
          <div className="py-8 text-center text-sm text-gray-400">No content yet.</div>
        )}
      </div>

      {/* Version history */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Version History</h3>
        <ul className="divide-y divide-gray-100">
          {doc.versions.map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="font-mono text-blue-600 w-14">v{v.version_label}</span>
              <span className="text-[10px] text-gray-500 uppercase w-12">{v.content_type === 'FILE' ? 'File' : 'Editor'}</span>
              <span className="flex-1 text-gray-700 truncate">
                {v.change_summary || (v.version === 1 ? 'Initial version' : 'Revision')}
              </span>
              {v.id === doc.current_version_id && (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Effective</span>
              )}
              {!v.is_locked && (
                <span className="text-[10px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">Draft</span>
              )}
              <span className="text-[11px] text-gray-400 w-32 text-right">{v.author_name ?? '—'}</span>
              <span className="text-[11px] text-gray-400 w-24 text-right">{new Date(v.created_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Audit trail — every change to this controlled document, including who
          viewed it. Distinct from Version History, which lists issued revisions. */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Audit Trail</h3>
        <p className="text-xs text-gray-500 mb-3">
          Every recorded action on this document and who performed it.
        </p>
        <EntityAuditTrail entityType="Document" entityId={doc.id} compact />
      </div>

      {/* Approve (e-signature) modal */}
      <Modal
        title="Approve & e-sign"
        open={approveOpen}
        onCancel={() => { setApproveOpen(false); setCredential(''); }}
        onOk={handleApprove}
        okText="Sign & Make Effective"
        okButtonProps={{ loading: approveMut.isPending }}
        centered
      >
        <p className="text-sm text-gray-600 mb-3">
          By signing you approve <span className="font-mono">{doc.doc_number}</span> v{working?.version_label} and make it
          the effective controlled version. Re-enter your signature PIN (or account password) to confirm — 21 CFR Part 11.
        </p>
        <Input.Password
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          placeholder="Signature PIN or password"
          onPressEnter={handleApprove}
          autoFocus
        />
      </Modal>

      {/* Reject modal */}
      <Modal
        title="Reject document"
        open={rejectOpen}
        onCancel={() => { setRejectOpen(false); setReason(''); }}
        onOk={handleReject}
        okText="Reject"
        okButtonProps={{ danger: true, loading: rejectMut.isPending }}
        centered
      >
        <p className="text-sm text-gray-600 mb-2">Provide a reason — it is recorded on the audit trail and returns the document to draft.</p>
        <Input.TextArea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection…" />
      </Modal>
    </PageContainer>
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
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    'Operation failed'
  );
}
