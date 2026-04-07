import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  ArrowRight,
  Users,
  Calendar,
  CheckCircle2,
  FileText,
  Shield,
  History,
  ClipboardCheck,
  Settings,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  DataTable,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import ApprovalTimeline from '@/components/ui/ApprovalTimeline';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { useChangeRequest } from './hooks';
import type { ImplementationTask, ChangeHistoryEntry } from './hooks';

const typeColors: Record<string, string> = {
  Process: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Product: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  System: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Document: 'bg-slate-100 text-slate-700 ring-slate-600/20',
};

const impactColors: Record<string, string> = {
  High: 'bg-red-50 text-red-700 ring-red-600/20',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Low: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

const statusColors: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700 ring-slate-600/20',
  'Under Review': 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'In Implementation': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  Validated: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  Closed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  Rejected: 'bg-red-50 text-red-700 ring-red-600/20',
};

const taskStatusColors: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-50 text-blue-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Overdue: 'bg-red-50 text-red-700',
};

const TABS = ['Details', 'Impact Assessment', 'Approvals', 'Implementation', 'Validation', 'History'];

export default function ChangeControlDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cr, isLoading } = useChangeRequest(id!);
  const [activeTab, setActiveTab] = useState('Details');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!cr) {
    return (
      <div className="py-32 text-center">
        <p className="text-slate-500">Change request not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/qms/change-control')}>
          Back to List
        </Button>
      </div>
    );
  }

  const canAdvance = !['Closed', 'Rejected', 'Validated'].includes(cr.status);

  const taskColumns: Column<ImplementationTask>[] = [
    {
      key: 'description',
      header: 'Task',
      render: (row) => <span className="text-sm font-medium text-slate-900">{row.description}</span>,
    },
    { key: 'owner', header: 'Owner' },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => {
        const overdue = new Date(row.dueDate) < new Date() && row.status !== 'Completed';
        return (
          <span className={cn('text-sm', overdue && 'font-semibold text-red-600')}>
            {formatDate(row.dueDate)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            taskStatusColors[row.status],
          )}
        >
          {row.status}
        </span>
      ),
    },
  ];

  const historyColumns: Column<ChangeHistoryEntry>[] = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (row) => (
        <span className="text-xs text-slate-500">{formatDateTime(row.timestamp)}</span>
      ),
    },
    { key: 'user', header: 'User' },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <span className="font-medium">{row.action}</span>,
    },
    { key: 'details', header: 'Details' },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button
          onClick={() => navigate('/qms/change-control')}
          className="hover:text-navy-700 transition-colors"
        >
          Change Control
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{cr.crNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{cr.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-navy-700">{cr.crNumber}</span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                typeColors[cr.changeType],
              )}
            >
              {cr.changeType}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                statusColors[cr.status],
              )}
            >
              {cr.status}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                impactColors[cr.impactLevel],
              )}
            >
              {cr.impactLevel} Impact
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdvance && (
            <Button>
              <ArrowRight className="h-4 w-4" />
              Advance Stage
            </Button>
          )}
          <Button variant="outline">
            <Users className="h-4 w-4" />
            Reassign
          </Button>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'border-b-2 border-navy-600 text-navy-700'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Details Tab */}
          {activeTab === 'Details' && (
            <Card>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  ['CR Number', cr.crNumber],
                  ['Change Type', cr.changeType],
                  ['Impact Level', cr.impactLevel],
                  ['Status', cr.status],
                  ['Requestor', cr.requestor],
                  ['Department', cr.department],
                  ['Target Date', formatDate(cr.targetDate)],
                  ['Regulatory Notification', cr.regulatoryNotification ? 'Yes' : 'No'],
                  ['Created', formatDate(cr.createdAt)],
                  ['Last Updated', formatDate(cr.updatedAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <p className="text-xs font-medium text-slate-500 mb-1">Description of Change</p>
                <p className="text-sm leading-relaxed text-slate-700">{cr.description}</p>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Reason for Change</p>
                <p className="text-sm leading-relaxed text-slate-700">{cr.reasonForChange}</p>
              </div>
              {cr.regulatoryNotification && (
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Regulatory Notice</p>
                  <p className="text-sm text-amber-800">
                    This change requires notification to relevant regulatory bodies before implementation.
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Impact Assessment Tab */}
          {activeTab === 'Impact Assessment' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-slate-400" />
                      Impact Assessment
                    </div>
                  </CardTitle>
                </CardHeader>
                <p className="text-sm leading-relaxed text-slate-700">{cr.impactAssessment}</p>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      Affected Documents
                    </div>
                  </CardTitle>
                </CardHeader>
                {cr.affectedDocuments.length > 0 ? (
                  <ul className="space-y-2">
                    {cr.affectedDocuments.map((doc, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm"
                      >
                        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-slate-700">{doc}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">No documents affected</p>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-slate-400" />
                      Affected Processes
                    </div>
                  </CardTitle>
                </CardHeader>
                {cr.affectedProcesses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {cr.affectedProcesses.map((proc) => (
                      <span
                        key={proc}
                        className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {proc}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No processes affected</p>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Evaluation</CardTitle>
                </CardHeader>
                <p className="text-sm leading-relaxed text-slate-700">
                  {cr.riskAssessment || 'No risk assessment provided.'}
                </p>
              </Card>
            </div>
          )}

          {/* Approvals Tab */}
          {activeTab === 'Approvals' && (
            <Card>
              <CardHeader>
                <CardTitle>Approval Workflow</CardTitle>
              </CardHeader>
              <div className="mt-4">
                <ApprovalTimeline stages={cr.approvalStages} />
              </div>
            </Card>
          )}

          {/* Implementation Tab */}
          {activeTab === 'Implementation' && (
            <Card noPadding>
              <div className="px-6 pt-6">
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-slate-400" />
                      Implementation Tasks
                    </div>
                  </CardTitle>
                  <Button size="sm" variant="outline">Add Task</Button>
                </CardHeader>
              </div>
              <DataTable
                columns={taskColumns}
                data={cr.implementationTasks}
                emptyMessage="No implementation tasks defined"
              />
            </Card>
          )}

          {/* Validation Tab */}
          {activeTab === 'Validation' && (
            <Card>
              <CardHeader>
                <CardTitle>Post-Change Validation</CardTitle>
              </CardHeader>
              {cr.validationResults ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Validated By</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">
                        {cr.validationResults.validatedBy}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Validation Date</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">
                        {formatDate(cr.validationResults.validationDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Validation Status</p>
                      <span
                        className={cn(
                          'mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          cr.validationResults.validated
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700',
                        )}
                      >
                        {cr.validationResults.validated ? 'Validated' : 'Not Validated'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Effectiveness Confirmed</p>
                      <span
                        className={cn(
                          'mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          cr.validationResults.effectivenessConfirmed
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        {cr.validationResults.effectivenessConfirmed ? 'Yes' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Validation Notes</p>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {cr.validationResults.notes}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-16">
                  <CheckCircle2 className="mb-3 h-12 w-12 text-slate-300" />
                  <p className="text-sm text-slate-400">
                    Validation will be available after implementation is complete
                  </p>
                  {cr.status === 'In Implementation' && (
                    <Button variant="outline" size="sm" className="mt-4">
                      Start Validation
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* History Tab */}
          {activeTab === 'History' && (
            <Card noPadding>
              <div className="px-6 pt-6">
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-slate-400" />
                      Change History
                    </div>
                  </CardTitle>
                </CardHeader>
              </div>
              <DataTable
                columns={historyColumns}
                data={cr.history}
                emptyMessage="No history entries"
              />
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              {[
                ['CR Number', cr.crNumber],
                ['Status', cr.status],
                ['Type', cr.changeType],
                ['Impact', cr.impactLevel],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Requestor Info */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  Requestor
                </div>
              </CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{cr.requestor}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Department</dt>
                <dd className="font-medium text-slate-900">{cr.department}</dd>
              </div>
            </dl>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Dates
                </div>
              </CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Created</dt>
                <dd className="font-medium text-slate-900">{formatDate(cr.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Target Date</dt>
                <dd
                  className={cn(
                    'font-medium',
                    new Date(cr.targetDate) < new Date() &&
                      !['Closed', 'Validated', 'Rejected'].includes(cr.status)
                      ? 'text-red-600'
                      : 'text-slate-900',
                  )}
                >
                  {formatDate(cr.targetDate)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Last Updated</dt>
                <dd className="font-medium text-slate-900">{formatDate(cr.updatedAt)}</dd>
              </div>
            </dl>
          </Card>

          {/* Notified Departments */}
          <Card>
            <CardHeader>
              <CardTitle>Notified Departments</CardTitle>
            </CardHeader>
            {cr.notifyDepartments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {cr.notifyDepartments.map((dept) => (
                  <span
                    key={dept}
                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                  >
                    {dept}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No departments notified</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
