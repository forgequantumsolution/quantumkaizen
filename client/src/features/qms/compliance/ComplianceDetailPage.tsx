import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Link2,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  StatusBadge,
} from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { lookupBadge } from '@/lib/badgeMap';
import { useComplianceRequirement } from './hooks';
import type { ComplianceStatus } from './hooks';

function getStatusBadge(status: ComplianceStatus | string) {
  const c = lookupBadge(
    {
      COMPLIANT: { variant: 'success', label: 'Compliant' },
      NON_COMPLIANT: { variant: 'danger', label: 'Non-Compliant' },
      PARTIAL: { variant: 'warning', label: 'Partial' },
      NOT_ASSESSED: { variant: 'default', label: 'Not Assessed' },
    },
    status,
  );
  return <Badge variant={c.variant as any}>{c.label}</Badge>;
}

export default function ComplianceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: requirement, isLoading } = useComplianceRequirement(id || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Requirement not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/qms/compliance')}>
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/qms/compliance')}
          className="mt-1 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Badge variant="info">{requirement.standard}</Badge>
            <span className="font-mono text-sm font-semibold text-slate-500">
              Clause {requirement.clauseNumber}
            </span>
            {getStatusBadge(requirement.status)}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{requirement.clauseTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assessor: {requirement.assessor} | Last Assessed: {formatDate(requirement.lastAssessed)} | Next Review: {formatDate(requirement.nextReview)}
          </p>
        </div>
      </div>

      {/* Clause Text */}
      <Card>
        <CardHeader>
          <CardTitle>Clause Text</CardTitle>
        </CardHeader>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm text-slate-700 leading-relaxed italic">
            "{requirement.clauseText}"
          </p>
        </div>
      </Card>

      {/* Assessment Findings */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment Findings</CardTitle>
          {getStatusBadge(requirement.status)}
        </CardHeader>
        <p className="text-sm text-slate-700 leading-relaxed">{requirement.findings}</p>
      </Card>

      {/* Linked Documents & Procedures */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Linked Procedures
              </span>
            </CardTitle>
          </CardHeader>
          <ul className="space-y-2">
            {requirement.linkedProcedures.map((proc, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg border border-surface-border-light px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileText className="h-4 w-4 text-sky-500 shrink-0" />
                <span className="text-slate-700">{proc}</span>
              </li>
            ))}
            {requirement.linkedProcedures.length === 0 && (
              <p className="text-sm text-slate-400 italic">No linked procedures</p>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-slate-400" />
                Linked Documents & CAPAs
              </span>
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Documents</p>
              <ul className="space-y-2">
                {requirement.linkedDocuments.map((doc, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-surface-border-light px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-slate-700">{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
            {requirement.linkedCAPAs.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Linked CAPAs</p>
                <ul className="space-y-2">
                  {requirement.linkedCAPAs.map((capa, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/30 px-3 py-2.5 text-sm hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      <span className="text-slate-700 font-mono text-xs font-semibold">{capa}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Gap Analysis & Action Items */}
      {requirement.gapActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Gap Analysis - Action Items
              </span>
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">#</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Owner</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Due Date</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {requirement.gapActions.map((action, idx) => (
                  <tr key={action.id} className="border-b border-surface-border-light last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-md">{action.action}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{action.owner}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(action.dueDate)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={action.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Assessment History */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              Assessment History
            </span>
          </CardTitle>
        </CardHeader>
        <div className="space-y-4">
          {requirement.assessmentHistory.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-start gap-4 border-l-2 border-slate-200 pl-4 pb-4 last:pb-0"
            >
              <div className="mt-0.5">
                {entry.status === 'COMPLIANT' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : entry.status === 'NON_COMPLIANT' ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-medium text-slate-900">{formatDate(entry.date)}</span>
                  {getStatusBadge(entry.status)}
                  <span className="text-xs text-slate-400">by {entry.assessor}</span>
                </div>
                <p className="text-sm text-slate-600">{entry.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
