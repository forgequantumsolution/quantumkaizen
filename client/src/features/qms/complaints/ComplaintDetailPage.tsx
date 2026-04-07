import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  ArrowRight,
  Users,
  Calendar,
  Mail,
  Phone,
  Video,
  FileText,
  History,
  MessageCircle,
  Link2,
  Search as SearchIcon,
  AlertTriangle,
} from 'lucide-react';
import TraceabilityChain from '@/components/shared/TraceabilityChain';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  DataTable,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { useComplaint, useUpdateComplaintStatus, getNextStatus } from './hooks';
import type { Complaint, Communication, ComplaintHistoryEntry } from './hooks';

const severityColors: Record<string, string> = {
  Critical: 'bg-red-50 text-red-700 ring-red-600/20',
  Major: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Minor: 'bg-slate-100 text-slate-700 ring-slate-600/20',
};

const statusColors: Record<string, string> = {
  Received: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Acknowledged: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'Under Investigation': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Resolution Proposed': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  Closed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

const commTypeIcons: Record<string, typeof Mail> = {
  Email: Mail,
  Phone: Phone,
  Meeting: Video,
  Letter: FileText,
};

const TABS = ['Details', 'Investigation', 'Resolution', 'Customer Communication', 'Linked CAPAs', 'History'];

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: complaint, isLoading } = useComplaint(id!);
  const updateStatus = useUpdateComplaintStatus();
  const [activeTab, setActiveTab] = useState('Details');
  const [showReassign, setShowReassign] = useState(false);
  const [reassignTo, setReassignTo] = useState('');
  const [investigationStarted, setInvestigationStarted] = useState(false);
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [showAddCommEntry, setShowAddCommEntry] = useState(false);
  const [newComm, setNewComm] = useState({ type: 'Email' as 'Email' | 'Phone' | 'Meeting' | 'Letter', direction: 'Outbound' as 'Inbound' | 'Outbound', summary: '', contactPerson: '' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="py-32 text-center">
        <p className="text-slate-500">Complaint not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/qms/complaints')}>
          Back to List
        </Button>
      </div>
    );
  }

  const canAdvance = complaint.status !== 'Closed';

  const historyColumns: Column<ComplaintHistoryEntry>[] = [
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
          onClick={() => navigate('/qms/complaints')}
          className="hover:text-navy-700 transition-colors"
        >
          Customer Complaints
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{complaint.complaintNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{complaint.subject}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-navy-700">
              {complaint.complaintNumber}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                severityColors[complaint.severity],
              )}
            >
              {complaint.severity}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                statusColors[complaint.status],
              )}
            >
              {complaint.status}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Customer: <span className="font-medium text-slate-700">{complaint.customerName}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdvance && (
            <Button
              disabled={updateStatus.isPending}
              onClick={() => {
                const next = getNextStatus(complaint.status);
                if (next) updateStatus.mutate({ id: complaint.id, status: next });
              }}
            >
              <ArrowRight className="h-4 w-4" />
              Advance Status
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/qms/non-conformances', { state: { linkComplaint: complaint?.complaintNumber } })}>
            <AlertTriangle size={14} />
            Link NC
          </Button>
          <Button variant="outline" onClick={() => setShowReassign(true)}>
            <Users className="h-4 w-4" />
            Reassign
          </Button>
        </div>
      </div>

      {/* Reassign inline form */}
      {showReassign && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900">Reassign Complaint</p>
          <input
            value={reassignTo}
            onChange={e => setReassignTo(e.target.value)}
            placeholder="Enter name or email..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowReassign(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
            <button
              onClick={() => { setShowReassign(false); setReassignTo(''); }}
              disabled={!reassignTo.trim()}
              className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-900/90 disabled:opacity-50"
            >
              Confirm Reassign
            </button>
          </div>
        </div>
      )}

      {/* Tabs + Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main */}
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
                  ['Complaint Number', complaint.complaintNumber],
                  ['Customer', complaint.customerName],
                  ['Contact Person', complaint.customerContact],
                  ['Email', complaint.customerEmail],
                  ['Severity', complaint.severity],
                  ['Status', complaint.status],
                  ['Product / Service', complaint.productService],
                  ['Batch / Order Ref', complaint.batchOrderRef],
                  ['Date Received', formatDate(complaint.receivedDate)],
                  ['Response Due', formatDate(complaint.responseDue)],
                  ['Assigned To', complaint.assignedTo],
                  ['Created', formatDate(complaint.createdAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
                <p className="text-sm leading-relaxed text-slate-700">{complaint.description}</p>
              </div>

              {/* Containment Actions */}
              {complaint.containmentActions.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-medium text-slate-500 mb-3">Containment Actions</p>
                  <div className="space-y-2">
                    {complaint.containmentActions.map((ca) => (
                      <div
                        key={ca.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm text-slate-700">{ca.description}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Owner: {ca.owner} — Due: {formatDate(ca.dueDate)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            ca.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : ca.status === 'In Progress'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {ca.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Investigation Tab */}
          {activeTab === 'Investigation' && (
            <div className="space-y-6">
              {complaint.investigation ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <div className="flex items-center gap-2">
                          <SearchIcon className="h-4 w-4 text-slate-400" />
                          Root Cause Findings
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Methodology</p>
                        <p className="text-sm text-slate-700">{complaint.investigation.methodology}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Root Cause</p>
                        <p className="text-sm leading-relaxed text-slate-700">
                          {complaint.investigation.rootCause}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Findings</p>
                        <p className="text-sm leading-relaxed text-slate-700">
                          {complaint.investigation.findings}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500">Investigated By</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">
                            {complaint.investigation.investigatedBy}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">Completed</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">
                            {formatDate(complaint.investigation.completedDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* 5-Whys */}
                  {complaint.investigation.fiveWhys.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>5-Whys Analysis</CardTitle>
                      </CardHeader>
                      <div className="space-y-2">
                        {complaint.investigation.fiveWhys.map((entry) => (
                          <div
                            key={entry.whyNumber}
                            className="rounded-lg border border-slate-200 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white">
                                {entry.whyNumber}
                              </span>
                              <div className="space-y-1.5">
                                <p className="text-sm font-medium text-slate-900">
                                  {entry.question}
                                </p>
                                <p className="text-sm text-slate-600">{entry.answer}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-16">
                    <SearchIcon className="mb-3 h-12 w-12 text-slate-300" />
                    <p className="text-sm text-slate-400">Investigation not yet started</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setInvestigationStarted(true)}>
                      Start Investigation
                    </Button>
                    {investigationStarted && (
                      <p className="mt-3 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                        Investigation started. Fill in findings and root cause when available.
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Resolution Tab */}
          {activeTab === 'Resolution' && (
            <Card>
              <CardHeader>
                <CardTitle>Proposed Resolution</CardTitle>
              </CardHeader>
              {complaint.resolution ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Proposed Resolution</p>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {complaint.resolution.proposedResolution}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Compensation Offered</p>
                    <p className="text-sm text-slate-700">
                      {complaint.resolution.compensationOffered || 'None'}
                    </p>
                  </div>
                  {complaint.resolution.resolutionDetails && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Resolution Details</p>
                      <p className="text-sm text-slate-700">
                        {complaint.resolution.resolutionDetails}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Resolved By</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">
                        {complaint.resolution.resolvedBy}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Customer Acceptance</p>
                      <span
                        className={cn(
                          'mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          complaint.resolution.customerAccepted === true
                            ? 'bg-emerald-50 text-emerald-700'
                            : complaint.resolution.customerAccepted === false
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        {complaint.resolution.customerAccepted === true
                          ? 'Accepted'
                          : complaint.resolution.customerAccepted === false
                            ? 'Rejected'
                            : 'Pending'}
                      </span>
                    </div>
                  </div>
                  {complaint.resolution.acceptedDate && (
                    <div>
                      <p className="text-xs font-medium text-slate-500">Accepted Date</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">
                        {formatDate(complaint.resolution.acceptedDate)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-16">
                  <p className="text-sm text-slate-400">No resolution proposed yet</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowResolutionForm(true)}>
                    Propose Resolution
                  </Button>
                  {showResolutionForm && (
                    <div className="mt-4 space-y-3 w-full">
                      <textarea
                        value={resolutionText}
                        onChange={e => setResolutionText(e.target.value)}
                        placeholder="Describe proposed resolution..."
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowResolutionForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                        <button
                          onClick={() => { setShowResolutionForm(false); setResolutionText(''); }}
                          disabled={!resolutionText.trim()}
                          className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-900/90 disabled:opacity-50"
                        >
                          Save Resolution
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Customer Communication Tab */}
          {activeTab === 'Customer Communication' && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-slate-400" />
                    Communication Timeline
                  </div>
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowAddCommEntry(true)}>Add Entry</Button>
              </CardHeader>
              {showAddCommEntry && (
                <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">New Communication Entry</p>
                  <div className="flex gap-3">
                    <select value={newComm.type} onChange={e => setNewComm(p => ({ ...p, type: e.target.value as typeof p.type }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="Email">Email</option>
                      <option value="Phone">Phone</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Letter">Letter</option>
                    </select>
                    <select value={newComm.direction} onChange={e => setNewComm(p => ({ ...p, direction: e.target.value as typeof p.direction }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                      <option value="Outbound">Outbound</option>
                      <option value="Inbound">Inbound</option>
                    </select>
                  </div>
                  <input value={newComm.contactPerson} onChange={e => setNewComm(p => ({ ...p, contactPerson: e.target.value }))} placeholder="Contact person..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  <textarea value={newComm.summary} onChange={e => setNewComm(p => ({ ...p, summary: e.target.value }))} placeholder="Summary of communication..." rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAddCommEntry(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                    <button
                      onClick={() => { setShowAddCommEntry(false); setNewComm({ type: 'Email', direction: 'Outbound', summary: '', contactPerson: '' }); }}
                      disabled={!newComm.summary.trim() || !newComm.contactPerson.trim()}
                      className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-900/90 disabled:opacity-50"
                    >
                      Save Entry
                    </button>
                  </div>
                </div>
              )}
              {complaint.communications.length > 0 ? (
                <div className="relative pl-8 space-y-0">
                  {complaint.communications.map((comm, idx) => {
                    const IconComp = commTypeIcons[comm.type] || Mail;
                    const isLast = idx === complaint.communications.length - 1;
                    return (
                      <div key={comm.id} className="relative pb-6 last:pb-0">
                        {!isLast && (
                          <div className="absolute left-[-21px] top-[18px] w-[2px] h-[calc(100%-2px)] bg-slate-200" />
                        )}
                        <div className="absolute left-[-27px] top-[3px] w-[14px] h-[14px] rounded-full bg-slate-300 flex items-center justify-center">
                          <IconComp size={8} className="text-white" strokeWidth={3} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                                comm.direction === 'Inbound'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {comm.direction}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500">
                              {comm.type}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(comm.date)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">{comm.summary}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {comm.contactPerson} — by {comm.user}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-8 text-center">
                  No communications recorded
                </p>
              )}
            </Card>
          )}

          {/* Linked CAPAs Tab */}
          {activeTab === 'Linked CAPAs' && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-slate-400" />
                    Linked CAPAs
                  </div>
                </CardTitle>
                <Button size="sm" onClick={() => navigate('/qms/capa/new', { state: { fromComplaint: complaint?.complaintNumber, title: `CAPA for ${complaint?.complaintNumber} — ${complaint?.subject}` } })}>Create CAPA</Button>
              </CardHeader>
              {complaint.linkedCAPAs.length > 0 ? (
                <div className="space-y-3">
                  {complaint.linkedCAPAs.map((capa) => (
                    <div
                      key={capa.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-navy-700">
                            {capa.capaNumber}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              capa.type === 'CORRECTIVE'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-purple-50 text-purple-700',
                            )}
                          >
                            {capa.type}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {capa.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{capa.title}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-400">No CAPAs linked to this complaint</p>
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
                      Complaint History
                    </div>
                  </CardTitle>
                </CardHeader>
              </div>
              <DataTable
                columns={historyColumns}
                data={complaint.history}
                emptyMessage="No history entries"
              />
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Complaint Details</CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              {[
                ['Number', complaint.complaintNumber],
                ['Status', complaint.status],
                ['Severity', complaint.severity],
                ['Product', complaint.productService],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900 text-right max-w-[140px] truncate">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  Customer
                </div>
              </CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500 text-xs">Company</dt>
                <dd className="font-medium text-slate-900 mt-0.5">{complaint.customerName}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Contact</dt>
                <dd className="font-medium text-slate-900 mt-0.5">{complaint.customerContact}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Email</dt>
                <dd className="font-medium text-slate-900 mt-0.5 break-all text-xs">
                  {complaint.customerEmail}
                </dd>
              </div>
            </dl>
          </Card>

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
                <dt className="text-slate-500">Received</dt>
                <dd className="font-medium text-slate-900">{formatDate(complaint.receivedDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Response Due</dt>
                <dd
                  className={cn(
                    'font-medium',
                    new Date(complaint.responseDue) < new Date() && complaint.status !== 'Closed'
                      ? 'text-red-600'
                      : 'text-slate-900',
                  )}
                >
                  {formatDate(complaint.responseDue)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Last Updated</dt>
                <dd className="font-medium text-slate-900">{formatDate(complaint.updatedAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Assigned To</dt>
                <dd className="font-medium text-slate-900">{complaint.assignedTo}</dd>
              </div>
            </dl>
          </Card>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Linked Records</h3>
            <TraceabilityChain
              items={[
                { id: complaint?.id || 'c1', type: 'Complaint' as const, number: complaint?.complaintNumber || '', title: complaint?.subject || '', status: complaint?.status || '', link: '#' },
                { id: 'nc-linked', type: 'NC' as const, number: 'NC-2026-018', title: 'Manufacturing defect — Part #A4422', status: 'Open', link: '/qms/non-conformances/NC-018' },
              ]}
              currentId={complaint?.id || 'c1'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
