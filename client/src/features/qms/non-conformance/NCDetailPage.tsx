import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  ArrowRight,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  History,
  GitBranch,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  StatusBadge,
  SeverityBadge,
  TypeBadge,
  DataTable,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import type { NonConformance, ContainmentAction, FiveWhyEntry, CAPA, AuditLogEntry } from '@/types';
import { cn, formatDate, formatDateTime, daysSince } from '@/lib/utils';
import { useNonConformance, useUpdateNCStatus } from './hooks';
import TraceabilityChain from '@/components/shared/TraceabilityChain';

// ── NC Lifecycle Stages ──────────────────────────────────────────────────────

const LIFECYCLE_STAGES = [
  'OPEN',
  'CONTAINMENT',
  'INVESTIGATION',
  'ROOT_CAUSE',
  'CAPA_PLANNING',
  'CAPA_IMPLEMENTATION',
  'CLOSED',
];

const STAGE_LABELS: Record<string, string> = {
  OPEN: 'Open',
  CONTAINMENT: 'Containment',
  INVESTIGATION: 'Investigation',
  ROOT_CAUSE: 'Root Cause',
  CAPA_PLANNING: 'CAPA Planning',
  CAPA_IMPLEMENTATION: 'CAPA Impl.',
  CLOSED: 'Closed',
};

// ── Mock supplemental data ───────────────────────────────────────────────────

const mockFiveWhys: FiveWhyEntry[] = [
  { whyNumber: 1, question: 'Why was the hardness below specification?', answer: 'The furnace temperature was 20 degrees below the required range during the soak cycle.' },
  { whyNumber: 2, question: 'Why was the furnace temperature below range?', answer: 'The temperature controller was reading inaccurately, showing 20 degrees higher than actual.' },
  { whyNumber: 3, question: 'Why was the controller reading inaccurately?', answer: 'The thermocouple had drifted out of calibration.' },
  { whyNumber: 4, question: 'Why had the thermocouple drifted out of calibration?', answer: 'Calibration was overdue by 2 weeks; the PM schedule was not followed.' },
  { whyNumber: 5, question: 'Why was the PM schedule not followed?', answer: 'The calibration tracking system had no automated alerts, relying solely on manual checks.' },
];

const mockCAPAs: CAPA[] = [
  {
    id: 'capa1', capaNumber: 'CAPA-2026-0019', title: 'Implement automated calibration alerts',
    type: 'CORRECTIVE', status: 'OPEN', linkedNCId: 'nc1', linkedNCNumber: 'NC-2026-0042',
    assignedTo: 'Anita Desai', dueDate: '2026-04-30', createdAt: '2026-03-30T10:00:00Z',
  },
];

const mockHistory: AuditLogEntry[] = [
  { id: 'h1', timestamp: '2026-03-30T09:15:00Z', userId: 'u6', userName: 'Deepak Nair', action: 'CREATE', entityType: 'NON_CONFORMANCE', entityId: 'NC-2026-0042', changedFields: null, ipAddress: '10.0.1.30' },
  { id: 'h2', timestamp: '2026-03-30T09:30:00Z', userId: 'u4', userName: 'Vikram Patel', action: 'ADD_CONTAINMENT', entityType: 'NON_CONFORMANCE', entityId: 'NC-2026-0042', changedFields: null, ipAddress: '10.0.1.8' },
  { id: 'h3', timestamp: '2026-03-30T10:00:00Z', userId: 'u1', userName: 'Priya Sharma', action: 'UPDATE_STATUS', entityType: 'NON_CONFORMANCE', entityId: 'NC-2026-0042', changedFields: { status: { before: 'OPEN', after: 'CONTAINMENT' } }, ipAddress: '10.0.1.12' },
];

const TABS = ['Details', 'Containment', 'Root Cause Analysis', 'CAPA', 'History', 'Traceability'];

export default function NCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: nc, isLoading } = useNonConformance(id!);
  const updateStatus = useUpdateNCStatus();
  const [activeTab, setActiveTab] = useState('Details');
  const [showSignModal, setShowSignModal] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [newAction, setNewAction] = useState({ description: '', owner: '', dueDate: '' });
  const [signName, setSignName] = useState('');
  const [signPassword, setSignPassword] = useState('');
  const [signComment, setSignComment] = useState('');
  const [expandedWhys, setExpandedWhys] = useState<Set<number>>(new Set([1]));

  const toggleWhy = (n: number) => {
    setExpandedWhys((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!nc) {
    return (
      <div className="py-32 text-center">
        <p className="text-slate-500">Non-conformance not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/qms/non-conformances')}>
          Back to List
        </Button>
      </div>
    );
  }

  const currentStageIdx = LIFECYCLE_STAGES.indexOf(nc.status);
  const canAdvance = nc.status !== 'CLOSED';

  const containmentColumns: Column<ContainmentAction>[] = [
    { key: 'description', header: 'Action', render: (row) => <span className="text-sm">{row.description}</span> },
    { key: 'owner', header: 'Owner' },
    { key: 'dueDate', header: 'Due Date', render: (row) => <span className="text-slate-500">{formatDate(row.dueDate)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  const historyColumns: Column<AuditLogEntry>[] = [
    { key: 'timestamp', header: 'Time', render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.timestamp)}</span> },
    { key: 'userName', header: 'User' },
    { key: 'action', header: 'Action', render: (row) => <span className="font-medium">{row.action.replace(/_/g, ' ')}</span> },
    {
      key: 'changedFields',
      header: 'Details',
      render: (row) => {
        if (!row.changedFields) return <span className="text-slate-400">—</span>;
        return (
          <span className="text-xs text-slate-500">
            {Object.entries(row.changedFields)
              .map(([field, change]) => `${field}: ${String(change.before)} -> ${String(change.after)}`)
              .join(', ')}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/qms/non-conformances')} className="hover:text-navy-700 transition-colors">
          Non-Conformances
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{nc.ncNumber}</span>
      </nav>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{nc.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={nc.status} />
            <SeverityBadge severity={nc.severity} />
            <TypeBadge type={nc.type} />
            <span className="text-xs text-slate-400">
              {daysSince(nc.createdAt)} days old
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdvance && (
            <Button
              onClick={async () => {
                const idx = LIFECYCLE_STAGES.indexOf(nc.status);
                const next = LIFECYCLE_STAGES[idx + 1];
                if (next && next !== 'CLOSED') {
                  await updateStatus.mutateAsync({ id: nc.id, status: next });
                }
              }}
              disabled={updateStatus.isPending}
            >
              <ArrowRight className="h-4 w-4" />
              Advance to Next Stage
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/qms/capa/new', { state: { fromNC: nc?.ncNumber, title: `CAPA for ${nc?.ncNumber}` } })}>
            <CheckCircle2 size={14} />
            Initiate CAPA
          </Button>
          <Button variant="outline" onClick={() => setShowReassign(true)}>
            <Users className="h-4 w-4" />
            Reassign
          </Button>
          {nc.status !== 'CLOSED' && (
            <Button variant="danger" onClick={() => setShowSignModal(true)}>
              <CheckCircle2 className="h-4 w-4" />
              Close NC
            </Button>
          )}
        </div>
      </div>

      {/* ── Lifecycle Progress Bar ───────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between">
          {LIFECYCLE_STAGES.map((stage, idx) => (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    idx < currentStageIdx
                      ? 'bg-emerald-500 text-white'
                      : idx === currentStageIdx
                        ? 'bg-navy-700 text-white ring-4 ring-navy-100'
                        : 'bg-slate-200 text-slate-500',
                  )}
                >
                  {idx < currentStageIdx ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium leading-tight text-center max-w-[72px]',
                    idx === currentStageIdx ? 'text-navy-700' : 'text-slate-400',
                  )}
                >
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              {idx < LIFECYCLE_STAGES.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-1',
                    idx < currentStageIdx ? 'bg-emerald-500' : 'bg-slate-200',
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* ── Tabs + Content ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors',
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
                  ['NC Number', nc.ncNumber],
                  ['Type', nc.type.replace(/_/g, ' ')],
                  ['Severity', nc.severity],
                  ['Source', nc.source || '—'],
                  ['Department', nc.department],
                  ['Product / Process', nc.productProcess || '—'],
                  ['Batch / Lot', nc.batchLot || '—'],
                  ['Created By', nc.createdBy],
                  ['Created', formatDate(nc.createdAt)],
                  ['Due Date', formatDate(nc.dueDate)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
                <p className="text-sm leading-relaxed text-slate-700">{nc.description}</p>
              </div>
              {nc.priorityJustification && (
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Priority Justification</p>
                  <p className="text-sm text-amber-800">{nc.priorityJustification}</p>
                </div>
              )}
            </Card>
          )}

          {/* Containment Tab */}
          {activeTab === 'Containment' && (
            <Card noPadding>
              <div className="px-6 pt-6">
                <CardHeader>
                  <CardTitle>Containment Actions</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setShowAddAction(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Action
                  </Button>
                </CardHeader>
              </div>
              <DataTable
                columns={containmentColumns}
                data={nc.containmentActions }
                emptyMessage="No containment actions recorded"
              />
              {showAddAction && (
                <div className="px-6 pb-6 pt-4 border-t border-slate-100 space-y-3">
                  <p className="text-sm font-medium text-slate-700">New Containment Action</p>
                  <input value={newAction.description} onChange={e => setNewAction(p => ({ ...p, description: e.target.value }))} placeholder="Action description" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20" />
                  <div className="flex gap-3">
                    <input value={newAction.owner} onChange={e => setNewAction(p => ({ ...p, owner: e.target.value }))} placeholder="Owner" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20" />
                    <input type="date" value={newAction.dueDate} onChange={e => setNewAction(p => ({ ...p, dueDate: e.target.value }))} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20" />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setShowAddAction(false)} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancel</button>
                    <button onClick={() => { setShowAddAction(false); setNewAction({ description: '', owner: '', dueDate: '' }); }} className="text-sm bg-navy-700 text-white px-4 py-1.5 rounded-lg hover:bg-navy-800" disabled={!newAction.description.trim()}>Add Action</button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Root Cause Analysis Tab */}
          {activeTab === 'Root Cause Analysis' && (
            <div className="space-y-6">
              {/* 5-Whys */}
              <Card>
                <CardHeader>
                  <CardTitle>5-Whys Analysis</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {mockFiveWhys.map((entry) => (
                    <div
                      key={entry.whyNumber}
                      className="rounded-lg border border-slate-200 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleWhy(entry.whyNumber)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white">
                          {entry.whyNumber}
                        </span>
                        <span className="flex-1 text-sm font-medium text-slate-900">
                          {entry.question}
                        </span>
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 text-slate-400 transition-transform',
                            expandedWhys.has(entry.whyNumber) && 'rotate-90',
                          )}
                        />
                      </button>
                      {expandedWhys.has(entry.whyNumber) && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 pl-14">
                          <p className="text-sm text-slate-700">{entry.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Fishbone Diagram Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle>Fishbone (Ishikawa) Diagram</CardTitle>
                </CardHeader>
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-16">
                  <GitBranch className="mb-3 h-12 w-12 text-slate-300" />
                  <p className="text-sm text-slate-400">
                    Fishbone diagram will be rendered here when root cause categories are defined
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab('Root Cause Analysis')}>
                    Start Fishbone Analysis
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* CAPA Tab */}
          {activeTab === 'CAPA' && (
            <Card>
              <CardHeader>
                <CardTitle>Linked CAPAs</CardTitle>
                <Button size="sm" onClick={() => navigate('/qms/capa/new', { state: { fromNC: nc.ncNumber, title: `CAPA for ${nc.ncNumber}` } })}>
                  <Plus className="h-3.5 w-3.5" />
                  Create CAPA
                </Button>
              </CardHeader>
              {mockCAPAs.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-400">No CAPAs linked to this NC</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mockCAPAs.map((capa) => (
                    <div
                      key={capa.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-navy-700">
                            {capa.capaNumber}
                          </span>
                          <TypeBadge type={capa.type} />
                          <StatusBadge status={capa.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{capa.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Assigned to {capa.assignedTo} — Due {formatDate(capa.dueDate)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  ))}
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
                      Audit History
                    </div>
                  </CardTitle>
                </CardHeader>
              </div>
              <DataTable
                columns={historyColumns}
                data={mockHistory }
                emptyMessage="No history entries"
              />
            </Card>
          )}

          {/* Traceability Tab */}
          {activeTab === 'Traceability' && (() => {
            const traceItems = [
              { id: nc?.id || 'current', type: 'NC' as const, number: nc?.ncNumber || 'NC-???', title: nc?.title || '', status: nc?.status || '', link: '#' },
              { id: 'CAPA-linked', type: 'CAPA' as const, number: 'CAPA-2026-003', title: `CAPA for ${nc?.ncNumber}`, status: 'In Progress', link: '/qms/capa/CAPA-003' },
              { id: 'RISK-linked', type: 'Risk' as const, number: 'RISK-2026-007', title: 'Recurring defect pattern risk', status: 'Mitigated', link: '/qms/risks/RISK-007' },
            ];
            return (
              <Card>
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Full audit trail showing how this record links to related quality actions.</p>
                  <TraceabilityChain items={traceItems} currentId={nc?.id || 'current'} />

                  {/* Link a related record manually */}
                  <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Link Related Record</p>
                    <div className="flex gap-2">
                      <select className="input-base flex-1 text-sm">
                        <option value="">Select record type...</option>
                        <option value="CAPA">CAPA</option>
                        <option value="Risk">Risk Register</option>
                        <option value="ChangeRequest">Change Request</option>
                        <option value="Complaint">Complaint</option>
                      </select>
                      <input type="text" placeholder="Record number" className="input-base w-40 text-sm" />
                      <Button variant="outline" size="sm">Link</Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })()}
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
                ['NC Number', nc.ncNumber],
                ['Status', nc.status.replace(/_/g, ' ')],
                ['Severity', nc.severity],
                ['Type', nc.type.replace(/_/g, ' ')],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  Assignment
                </div>
              </CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Assigned To</dt>
                <dd className="font-medium text-slate-900">{nc.assignedTo || 'Unassigned'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Created By</dt>
                <dd className="font-medium text-slate-900">{nc.createdBy}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Department</dt>
                <dd className="font-medium text-slate-900">{nc.department}</dd>
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
                <dd className="font-medium text-slate-900">{formatDate(nc.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Due Date</dt>
                <dd
                  className={cn(
                    'font-medium',
                    nc.dueDate && new Date(nc.dueDate) < new Date() && nc.status !== 'CLOSED'
                      ? 'text-red-600'
                      : 'text-slate-900',
                  )}
                >
                  {formatDate(nc.dueDate)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Last Updated</dt>
                <dd className="font-medium text-slate-900">{formatDate(nc.updatedAt)}</dd>
              </div>
              {nc.closedAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Closed</dt>
                  <dd className="font-medium text-emerald-600">{formatDate(nc.closedAt)}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Linked Records */}
          <Card>
            <CardHeader>
              <CardTitle>Linked Records</CardTitle>
            </CardHeader>
            {mockCAPAs.length > 0 ? (
              <div className="space-y-2">
                {mockCAPAs.map((capa) => (
                  <div key={capa.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="info">CAPA</Badge>
                    <span className="font-mono text-xs text-navy-700">{capa.capaNumber}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No linked records</p>
            )}
          </Card>
        </div>
      </div>

      {/* ── Reassign Modal ───────────────────────────────────────────────── */}
      {showReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Reassign Non-Conformance</h3>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20 mb-4">
              <option>Priya Sharma</option>
              <option>Anita Desai</option>
              <option>Vikram Patel</option>
              <option>Deepak Nair</option>
              <option>Sunita Rao</option>
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowReassign(false)} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancel</button>
              <button onClick={() => setShowReassign(false)} className="text-sm bg-navy-700 text-white px-4 py-1.5 rounded-lg hover:bg-navy-800">Reassign</button>
            </div>
          </div>
        </div>
      )}

      {/* ── E-Signature Modal ────────────────────────────────────────────── */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Close Non-Conformance</CardTitle>
            </CardHeader>
            <p className="mb-4 text-sm text-slate-600">
              By signing below, you confirm that this non-conformance has been adequately
              investigated, all corrective actions have been completed, and the NC can be closed.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  placeholder="Enter your full name"
                  value={signName}
                  onChange={e => setSignName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  placeholder="Enter your password to confirm"
                  value={signPassword}
                  onChange={e => setSignPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Closure Comment</label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  placeholder="Summarize the resolution and any lessons learned"
                  value={signComment}
                  onChange={e => setSignComment(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSignModal(false)}>Cancel</Button>
              <Button
                variant="danger"
                disabled={!signName.trim() || !signPassword.trim() || updateStatus.isPending}
                onClick={async () => {
                  if (!signName.trim() || !signPassword.trim()) return;
                  await updateStatus.mutateAsync({ id: nc.id, status: 'CLOSED' });
                  setShowSignModal(false);
                  setSignName(''); setSignPassword(''); setSignComment('');
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Sign & Close NC
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
