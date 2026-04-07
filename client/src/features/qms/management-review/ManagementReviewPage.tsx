import React, { useState } from 'react';
import {
  Calendar,
  Users,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Download,
  BookOpen,
  GraduationCap,
  Truck,
  Shield,
  ClipboardList,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  DataTable,
  StatsCard,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import {
  useManagementReviews,
  useManagementReviewSummary,
  useScheduleReview,
  mockActionItems,
  mockReviews,
} from './hooks';
import type { ActionItem, ManagementReview } from './hooks';

const actionStatusColors: Record<string, string> = {
  Open: 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-amber-50 text-amber-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Overdue: 'bg-red-50 text-red-700',
};

const priorityColors: Record<string, string> = {
  High: 'bg-red-50 text-red-700 ring-red-600/20',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Low: 'bg-slate-100 text-slate-700 ring-slate-600/20',
};

const reviewStatusColors: Record<string, string> = {
  Scheduled: 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-amber-50 text-amber-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-slate-100 text-slate-500',
};

export default function ManagementReviewPage() {
  const { data: reviewData } = useManagementReviews();
  const { data: summaryData } = useManagementReviewSummary();

  const reviews = reviewData?.reviews ?? mockReviews;
  const actionItems = reviewData?.actionItems ?? mockActionItems;
  const qms = summaryData?.qms;
  const dms = summaryData?.dms;
  const lms = summaryData?.lms;
  const supplier = summaryData?.supplier;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['qms']));
  const scheduleReview = useScheduleReview();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ title: '', date: '', time: '09:00', agenda: '' });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const upcomingReviews = reviews.filter(
    (r: ManagementReview) => r.status === 'Scheduled' || r.status === 'In Progress',
  );
  const pastReviews = reviews.filter(
    (r: ManagementReview) => r.status === 'Completed' || r.status === 'Cancelled',
  );

  const actionColumns: Column<ActionItem>[] = [
    {
      key: 'action',
      header: 'Action Item',
      render: (row) => (
        <span className="block max-w-xs text-sm font-medium text-slate-900">{row.action}</span>
      ),
    },
    { key: 'owner', header: 'Owner' },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
            priorityColors[row.priority],
          )}
        >
          {row.priority}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => {
        const overdue =
          new Date(row.dueDate) < new Date() && row.status !== 'Completed';
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
            actionStatusColors[row.status],
          )}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'reviewTitle',
      header: 'Source Review',
      render: (row) => (
        <span className="text-xs text-slate-500">{row.reviewTitle}</span>
      ),
    },
  ];

  const renderReviewCard = (review: ManagementReview) => (
    <Card key={review.id} className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{review.title}</h3>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                reviewStatusColors[review.status],
              )}
            >
              {review.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(review.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {review.time}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {review.attendees.length} attendees
            </span>
          </div>
        </div>
        {review.status === 'Completed' && (
          <Button variant="outline" size="sm">
            <FileText className="h-3.5 w-3.5" />
            View Minutes
          </Button>
        )}
      </div>

      {/* Attendees */}
      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 mb-2">Attendees</p>
        <div className="flex flex-wrap gap-1.5">
          {review.attendees.map((attendee) => (
            <span
              key={attendee.name}
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                attendee.present === false
                  ? 'bg-red-50 text-red-600 line-through'
                  : 'bg-slate-100 text-slate-700',
              )}
            >
              {attendee.name}
              <span className="ml-1 text-slate-400 font-normal">({attendee.role})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Agenda */}
      {review.agenda.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Agenda</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
            {review.agenda.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Minutes Summary */}
      {review.minutesSummary && (
        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 mb-1">Minutes Summary</p>
          <p className="text-sm leading-relaxed text-slate-700">{review.minutesSummary}</p>
        </div>
      )}
    </Card>
  );

  const renderSummarySection = (
    key: string,
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode,
  ) => {
    const isExpanded = expandedSections.has(key);
    return (
      <div key={key} className="rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection(key)}
          className="flex w-full items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {icon}
            <span className="text-sm font-semibold text-slate-900">{title}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </button>
        {isExpanded && (
          <div className="border-t border-slate-200 px-5 py-4 bg-slate-50/50">
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Management Review</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review QMS performance, track action items, and generate review packs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowScheduleModal(true)}>
            <Calendar className="h-4 w-4" />
            Schedule Review
          </Button>
          <Button onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Generate Review Pack
          </Button>
        </div>
      </div>

      {/* Upcoming Reviews */}
      {upcomingReviews.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming Reviews</h2>
          {upcomingReviews.map(renderReviewCard)}
        </div>
      )}

      {/* Management Review Pack */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Management Review Pack</h2>
          <p className="text-xs text-slate-400">Aggregated data from all QMS modules</p>
        </div>

        {/* Summary Stats Row */}
        {qms && dms && lms && supplier && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Open NCs"
              value={qms.ncOpenCount}
              icon={AlertTriangle}
              iconColor="bg-amber-50 text-amber-600"
            />
            <StatsCard
              title="Training Compliance"
              value={`${lms.trainingCompliancePercent}%`}
              icon={GraduationCap}
              iconColor="bg-sky-50 text-sky-600"
            />
            <StatsCard
              title="Docs Due for Review"
              value={dms.documentsDueForReview}
              icon={BookOpen}
              iconColor="bg-purple-50 text-purple-600"
            />
            <StatsCard
              title="Supplier Rating"
              value={`${supplier.avgSupplierRating}/5.0`}
              icon={TrendingUp}
              iconColor="bg-emerald-50 text-emerald-600"
            />
          </div>
        )}

        {/* Expandable Sections */}
        <div className="space-y-2">
          {qms &&
            renderSummarySection(
              'qms',
              'QMS Summary (NC, CAPA & Audit Findings)',
              <Shield className="h-5 w-5 text-blue-600" />,
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {[
                  ['Total NCs', qms.ncCount],
                  ['Open NCs', qms.ncOpenCount],
                  ['Closed This Quarter', qms.ncClosedThisQuarter],
                  ['Avg Closure Time', `${qms.ncAvgClosureTime} days`],
                  ['Total CAPAs', qms.capaCount],
                  ['Open CAPAs', qms.capaOpenCount],
                  ['CAPA Effectiveness', `${qms.capaEffectivenessRate}%`],
                  ['Total Audit Findings', qms.auditFindingsTotal],
                  ['Open Findings', qms.auditFindingsOpen],
                  ['Major Findings', qms.auditFindingsMajor],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>,
            )}

          {dms &&
            renderSummarySection(
              'dms',
              'DMS Summary (Document Management)',
              <BookOpen className="h-5 w-5 text-purple-600" />,
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ['Total Documents', dms.totalDocuments],
                  ['Due for Review', dms.documentsDueForReview],
                  ['New This Quarter', dms.newDocumentsThisQuarter],
                  ['Overdue Reviews', dms.overdueReviews],
                  ['Pending Approvals', dms.pendingApprovals],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>,
            )}

          {lms &&
            renderSummarySection(
              'lms',
              'LMS Summary (Training & Competency)',
              <GraduationCap className="h-5 w-5 text-sky-600" />,
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['Compliance %', `${lms.trainingCompliancePercent}%`],
                  ['Total Trainings', lms.totalTrainings],
                  ['Completed', lms.completedTrainings],
                  ['Expiring Certs', lms.expiringCertifications],
                  ['Overdue Certs', lms.overdueCertifications],
                  ['Avg Hrs/Employee', lms.avgTrainingHoursPerEmployee],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>,
            )}

          {supplier &&
            renderSummarySection(
              'supplier',
              'Supplier Summary (Performance & Evaluation)',
              <Truck className="h-5 w-5 text-emerald-600" />,
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['Total Suppliers', supplier.totalSuppliers],
                  ['Approved', supplier.approvedSuppliers],
                  ['On Watch', supplier.suppliersOnWatch],
                  ['Avg Rating', `${supplier.avgSupplierRating}/5.0`],
                  ['Supplier NCs', supplier.supplierNCCount],
                  ['Overdue Evals', supplier.overdueEvaluations],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>,
            )}
        </div>
      </div>

      {/* Action Items from Previous Reviews */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-400" />
              Action Items from Previous Reviews
            </div>
          </h2>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {actionItems.filter((a: ActionItem) => a.status === 'Completed').length} completed
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              {actionItems.filter((a: ActionItem) => a.status === 'Overdue').length} overdue
            </span>
          </div>
        </div>
        <Card noPadding>
          <DataTable
            columns={actionColumns}
            data={actionItems}
            rowClassName={(row) => {
              const item = row as ActionItem;
              return item.status === 'Overdue' ? 'bg-red-50/40' : '';
            }}
            emptyMessage="No action items"
          />
        </Card>
      </div>

      {/* Past Reviews */}
      {pastReviews.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Past Reviews</h2>
          {pastReviews.map(renderReviewCard)}
        </div>
      )}

      {/* Schedule Review Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Schedule Management Review</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Review Title</label>
                <input
                  type="text"
                  value={scheduleForm.title}
                  onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Q2 2026 Management Review"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduleForm.date}
                    onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Agenda Items</label>
                <textarea
                  value={scheduleForm.agenda}
                  onChange={e => setScheduleForm(f => ({ ...f, agenda: e.target.value }))}
                  placeholder="One agenda item per line..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
              <Button
                isLoading={scheduleReview.isPending}
                onClick={async () => {
                  if (!scheduleForm.title || !scheduleForm.date) return;
                  await scheduleReview.mutateAsync(scheduleForm);
                  setShowScheduleModal(false);
                  setScheduleForm({ title: '', date: '', time: '09:00', agenda: '' });
                }}
                disabled={!scheduleForm.title || !scheduleForm.date || scheduleReview.isPending}
              >
                <Calendar className="h-4 w-4" />
                Schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
