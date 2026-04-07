import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Download,
  Users,
  QrCode,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, Badge, StatusBadge } from '@/components/ui';
import type { ApprovalStep, DocumentVersion } from '@/types';
import { formatDate, cn } from '@/lib/utils';
import { useDocument } from './hooks';
import ESignatureModal from '@/components/shared/ESignatureModal';

// ── Mock supplemental data ───────────────────────────────────────────────────

const mockVersions: DocumentVersion[] = [
  { id: 'v3', version: '3.1', changedBy: 'Rajesh Kumar', changedAt: '2025-06-01T08:00:00Z', changeSummary: 'Annual review — updated section 5 responsibilities.', status: 'PUBLISHED' },
  { id: 'v2', version: '3.0', changedBy: 'Rajesh Kumar', changedAt: '2024-06-01T10:00:00Z', changeSummary: 'Major revision for ISO 9001:2015 alignment.', status: 'ARCHIVED' },
  { id: 'v1', version: '2.0', changedBy: 'Priya Sharma', changedAt: '2023-06-01T10:00:00Z', changeSummary: 'Initial migration to digital system.', status: 'ARCHIVED' },
];

const mockApprovalSteps: ApprovalStep[] = [
  { id: 'a1', stepOrder: 1, role: 'Author', approverName: 'Vikram Patel', status: 'APPROVED', comment: null, completedAt: '2026-03-25T10:00:00Z' },
  { id: 'a2', stepOrder: 2, role: 'Reviewer', approverName: 'Anita Desai', status: 'APPROVED', comment: 'Reviewed and verified.', completedAt: '2026-03-27T14:00:00Z' },
  { id: 'a3', stepOrder: 3, role: 'Quality Manager', approverName: 'Rajesh Kumar', status: 'PENDING', comment: null, completedAt: null },
  { id: 'a4', stepOrder: 4, role: 'Department Head', approverName: null, status: 'PENDING', comment: null, completedAt: null },
];

const mockAcknowledgement = {
  total: 24,
  acknowledged: 18,
  pending: 6,
};

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: doc, isLoading } = useDocument(id!);
  const [showSignModal, setShowSignModal] = useState(false);

  // ── Version comparison state ─────────────────────────────────────────────
  const [compareVersions, setCompareVersions] = useState<[string, string]>(['', '']);

  // ── Acknowledge state ────────────────────────────────────────────────────
  const [showAckModal, setShowAckModal] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="py-32 text-center">
        <p className="text-slate-500">Document not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dms/documents')}>
          Back to Documents
        </Button>
      </div>
    );
  }

  const canSubmitForReview = doc.status === 'DRAFT';
  const canApprove = doc.status === 'PENDING_APPROVAL';
  const canReject = doc.status === 'PENDING_APPROVAL' || doc.status === 'UNDER_REVIEW';

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/dms/documents')} className="hover:text-navy-700 transition-colors">
          Documents
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{doc.documentNumber}</span>
      </nav>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={doc.status} />
            <Badge variant="outline">v{doc.version}</Badge>
            <Badge variant="outline">{doc.level.replace(/_/g, ' ')}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSubmitForReview && (
            <Button onClick={() => {
              // In production: call updateDocument mutation with status: 'IN_REVIEW'
              alert(`Document "${doc.title}" submitted for review.`);
            }}>
              <Send className="h-4 w-4" />
              Submit for Review
            </Button>
          )}
          {canApprove && (
            <Button onClick={() => setShowSignModal(true)}>
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
          )}
          {canReject && (
            <Button variant="danger" onClick={() => {
              // In production: call updateDocument mutation with status: 'REJECTED'
              const reason = window.prompt('Enter rejection reason:');
              if (reason !== null) alert(`Document rejected: ${reason}`);
            }}>
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          )}
          <Button variant="outline" onClick={() => {
            // In production: download from server using documentNumber
            alert(`Downloading ${doc.documentNumber} v${doc.version}`);
          }}>
            <Download className="h-4 w-4" />
            Download
          </Button>
          {/* ── Acknowledge button ──────────────────────────────────────── */}
          {!acknowledged ? (
            <Button variant="outline" size="sm" onClick={() => setShowAckModal(true)}>
              <CheckCircle2 size={14} />
              Acknowledge
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
              <CheckCircle2 size={13} />
              Acknowledged
            </div>
          )}
        </div>
      </div>

      {/* ── Two-Column Layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left — Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Document Content</CardTitle>
            </CardHeader>
            <p className="text-sm leading-relaxed text-slate-600">
              {doc.description || 'No description provided.'}
            </p>
            {doc.changeSummary && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">Change Summary</p>
                <p className="text-sm text-amber-800">{doc.changeSummary}</p>
              </div>
            )}
          </Card>

          {/* File Preview Area */}
          <Card>
            <CardHeader>
              <CardTitle>File Preview</CardTitle>
            </CardHeader>
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-16">
              <FileText className="mb-3 h-12 w-12 text-slate-300" />
              <p className="text-sm text-slate-400">
                File preview will be available when a document is uploaded
              </p>
            </div>
          </Card>

          {/* Approval Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow</CardTitle>
            </CardHeader>
            <div className="space-y-0">
              {mockApprovalSteps.map((step, idx) => (
                <div key={step.id} className="flex gap-4">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                        step.status === 'APPROVED'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                          : step.status === 'REJECTED'
                            ? 'border-red-500 bg-red-50 text-red-600'
                            : 'border-slate-300 bg-white text-slate-400'
                      }`}
                    >
                      {step.status === 'APPROVED' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : step.status === 'REJECTED' ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    {idx < mockApprovalSteps.length - 1 && (
                      <div className="w-0.5 flex-1 bg-slate-200" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-6">
                    <p className="text-sm font-medium text-slate-900">
                      Step {step.stepOrder}: {step.role}
                    </p>
                    <p className="text-xs text-slate-500">
                      {step.approverName || 'Unassigned'}
                      {step.completedAt && ` — ${formatDate(step.completedAt)}`}
                    </p>
                    {step.comment && (
                      <p className="mt-1 text-xs italic text-slate-500">"{step.comment}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right — Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              {[
                ['Number', doc.documentNumber],
                ['Level', doc.level.replace(/_/g, ' ')],
                ['Category', doc.category || '—'],
                ['Department', doc.department],
                ['Owner', doc.owner],
                ['Created', formatDate(doc.createdAt)],
                ['Effective Date', formatDate(doc.effectiveDate)],
                ['Expiry Date', formatDate(doc.expiryDate)],
                ['Review Date', formatDate(doc.reviewDate)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
            {doc.tags && doc.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {doc.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* ── QR Code Quick Access ──────────────────────────────────── */}
            <div className="pt-3 border-t border-gray-100 mt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Access</p>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                  <QrCode size={28} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">QR Code</p>
                  <p className="text-xs text-gray-400 mt-0.5">Scan to open document</p>
                  <button className="text-xs text-slate-900 font-medium hover:underline mt-1">
                    Download QR
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Version History with Compare */}
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
            </CardHeader>

            {/* Version list with Select buttons */}
            <div className="space-y-2">
              {mockVersions.map((v) => (
                <div key={v.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-mono font-bold text-slate-700">v{v.version}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{v.changeSummary || 'No description'}</p>
                    <p className="text-xs text-gray-400">{v.changedBy} · {new Date(v.changedAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() =>
                      setCompareVersions((c) =>
                        c[0] === '' ? [v.version, c[1]] : [c[0], v.version]
                      )
                    }
                    className={cn(
                      'text-xs px-2 py-1 rounded border transition-colors shrink-0',
                      compareVersions.includes(v.version)
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    {compareVersions.includes(v.version) ? 'Selected' : 'Select'}
                  </button>
                </div>
              ))}
            </div>

            {/* Clear selection helper */}
            {(compareVersions[0] || compareVersions[1]) && (
              <button
                onClick={() => setCompareVersions(['', ''])}
                className="text-xs text-slate-400 hover:text-slate-600 mt-2"
              >
                Clear selection
              </button>
            )}

            {/* Version Comparison Panel */}
            {compareVersions[0] && compareVersions[1] && (
              <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-700">Version Comparison</span>
                  <div className="flex gap-4 text-xs items-center">
                    <span className="font-mono bg-red-100 text-red-700 px-2 py-0.5 rounded">v{compareVersions[0]}</span>
                    <span className="text-gray-300">→</span>
                    <span className="font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded">v{compareVersions[1]}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                  {compareVersions.map((ver, idx) => {
                    const versionData = mockVersions.find((v) => v.version === ver);
                    return (
                      <div
                        key={ver}
                        className={cn('p-4 text-xs font-mono', idx === 0 ? 'bg-red-50/40' : 'bg-green-50/40')}
                      >
                        <p className={cn('font-semibold mb-2', idx === 0 ? 'text-red-700' : 'text-green-700')}>
                          Version {ver}
                        </p>
                        <div className="space-y-1 text-gray-600">
                          <p>Title: {doc?.title}</p>
                          <p>Status: {idx === 0 ? 'Previous' : 'Current'}</p>
                          <p>Change log: {versionData?.changeSummary || 'N/A'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Distribution & Acknowledgement */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  Distribution
                </div>
              </CardTitle>
            </CardHeader>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Recipients</span>
                <span className="font-medium text-slate-900">{mockAcknowledgement.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Acknowledged</span>
                <span className="font-medium text-emerald-600">{mockAcknowledgement.acknowledged}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Pending</span>
                <span className="font-medium text-amber-600">{mockAcknowledgement.pending}</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${(mockAcknowledgement.acknowledged / mockAcknowledgement.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── E-Signature Modal (Approve) ──────────────────────────────────────── */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Electronic Signature</CardTitle>
            </CardHeader>
            <p className="mb-4 text-sm text-slate-600">
              By signing below, you confirm that you have reviewed this document and approve it for publication.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  placeholder="Enter your password to confirm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Comment (optional)
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  placeholder="Add a comment"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSignModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowSignModal(false)}>
                <CheckCircle2 className="h-4 w-4" />
                Sign & Approve
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── E-Signature Modal (Acknowledge) ──────────────────────────────────── */}
      <ESignatureModal
        isOpen={showAckModal}
        onClose={() => setShowAckModal(false)}
        onSign={(_password, _meaning, _comment) => {
          // In production: POST /dms/documents/:id/acknowledge
          setAcknowledged(true);
          setShowAckModal(false);
        }}
        entityType="Document"
        entityId={doc?.documentNumber || id || ''}
      />
    </div>
  );
}
