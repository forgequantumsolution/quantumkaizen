import React, { useState } from 'react';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, DataTable, Badge } from '@/components/ui';
import type { Column } from '@/components/ui';
import type { AuditLogEntry } from '@/types';
import { formatDateTime } from '@/lib/utils';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockAuditLog: AuditLogEntry[] = [
  {
    id: 'al1', timestamp: '2026-03-30T09:15:00Z', userId: 'u6', userName: 'Deepak Nair',
    action: 'CREATE', entityType: 'NON_CONFORMANCE', entityId: 'NC-2026-0042',
    changedFields: null, ipAddress: '10.0.1.30',
    details: { title: 'Out-of-spec hardness on batch HT-2026-112', severity: 'CRITICAL' },
  },
  {
    id: 'al2', timestamp: '2026-03-30T08:47:00Z', userId: 'u2', userName: 'Rajesh Kumar',
    action: 'APPROVE', entityType: 'DOCUMENT', entityId: 'SOP-QMS-001',
    changedFields: { status: { before: 'PENDING_APPROVAL', after: 'APPROVED' } },
    ipAddress: '10.0.1.15',
  },
  {
    id: 'al3', timestamp: '2026-03-29T17:30:00Z', userId: 'u3', userName: 'Anita Desai',
    action: 'UPDATE', entityType: 'CAPA', entityId: 'CAPA-2026-0018',
    changedFields: { status: { before: 'OPEN', after: 'IN_PROGRESS' } },
    ipAddress: '10.0.1.20',
  },
  {
    id: 'al4', timestamp: '2026-03-29T16:12:00Z', userId: 'u1', userName: 'Priya Sharma',
    action: 'SUBMIT_FOR_REVIEW', entityType: 'DOCUMENT', entityId: 'WI-PRD-012',
    changedFields: { status: { before: 'DRAFT', after: 'UNDER_REVIEW' } },
    ipAddress: '10.0.1.12',
  },
  {
    id: 'al5', timestamp: '2026-03-29T14:55:00Z', userId: 'u4', userName: 'Vikram Patel',
    action: 'CREATE', entityType: 'DOCUMENT', entityId: 'FRM-QC-045',
    changedFields: null, ipAddress: '10.0.1.8',
    details: { title: 'Incoming Material Inspection Checklist', level: 'FORM' },
  },
  {
    id: 'al6', timestamp: '2026-03-29T11:20:00Z', userId: 'u5', userName: 'Sunita Rao',
    action: 'CLOSE', entityType: 'NON_CONFORMANCE', entityId: 'NC-2026-0038',
    changedFields: { status: { before: 'CAPA_IMPLEMENTATION', after: 'CLOSED' } },
    ipAddress: '10.0.1.22',
  },
  {
    id: 'al7', timestamp: '2026-03-28T16:45:00Z', userId: 'u2', userName: 'Rajesh Kumar',
    action: 'REJECT', entityType: 'DOCUMENT', entityId: 'SOP-MFG-003',
    changedFields: { status: { before: 'UNDER_REVIEW', after: 'DRAFT' } },
    ipAddress: '10.0.1.15',
    details: { reason: 'Section 4.2 references outdated standard. Please update.' },
  },
  {
    id: 'al8', timestamp: '2026-03-28T10:30:00Z', userId: 'u6', userName: 'Deepak Nair',
    action: 'CREATE', entityType: 'NON_CONFORMANCE', entityId: 'NC-2026-0041',
    changedFields: null, ipAddress: '10.0.1.30',
    details: { title: 'Dimensional deviation in machined valve body', severity: 'MAJOR' },
  },
  {
    id: 'al9', timestamp: '2026-03-27T15:00:00Z', userId: 'u3', userName: 'Anita Desai',
    action: 'UPDATE', entityType: 'NON_CONFORMANCE', entityId: 'NC-2026-0039',
    changedFields: { severity: { before: 'MINOR', after: 'MAJOR' } },
    ipAddress: '10.0.1.20',
  },
  {
    id: 'al10', timestamp: '2026-03-27T09:15:00Z', userId: 'u4', userName: 'Vikram Patel',
    action: 'PUBLISH', entityType: 'DOCUMENT', entityId: 'SOP-ENG-007',
    changedFields: { status: { before: 'APPROVED', after: 'PUBLISHED' } },
    ipAddress: '10.0.1.8',
  },
  {
    id: 'al11', timestamp: '2026-03-26T14:30:00Z', userId: 'u1', userName: 'Priya Sharma',
    action: 'LOGIN', entityType: 'AUTH', entityId: null,
    changedFields: null, ipAddress: '10.0.1.12',
  },
  {
    id: 'al12', timestamp: '2026-03-26T11:00:00Z', userId: 'u5', userName: 'Sunita Rao',
    action: 'UPDATE_STATUS', entityType: 'NON_CONFORMANCE', entityId: 'NC-2026-0037',
    changedFields: { status: { before: 'CAPA_PLANNING', after: 'CAPA_IMPLEMENTATION' } },
    ipAddress: '10.0.1.22',
  },
];

const ENTITY_TYPES = ['', 'NON_CONFORMANCE', 'DOCUMENT', 'CAPA', 'AUTH', 'USER'];
const ACTION_TYPES = ['', 'CREATE', 'UPDATE', 'APPROVE', 'REJECT', 'CLOSE', 'PUBLISH', 'SUBMIT_FOR_REVIEW', 'UPDATE_STATUS', 'LOGIN', 'LOGOUT'];
const USERS = ['', 'Priya Sharma', 'Rajesh Kumar', 'Anita Desai', 'Vikram Patel', 'Sunita Rao', 'Deepak Nair'];

export default function AuditLogPage() {
  const [entityFilter, setEntityFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = mockAuditLog.filter((entry) => {
    if (entityFilter && entry.entityType !== entityFilter) return false;
    if (userFilter && entry.userName !== userFilter) return false;
    if (actionFilter && entry.action !== actionFilter) return false;
    return true;
  });

  const actionBadgeVariant = (action: string) => {
    if (['CREATE', 'PUBLISH'].includes(action)) return 'success' as const;
    if (['APPROVE', 'CLOSE'].includes(action)) return 'success' as const;
    if (['REJECT'].includes(action)) return 'danger' as const;
    if (['UPDATE', 'UPDATE_STATUS', 'SUBMIT_FOR_REVIEW'].includes(action)) return 'info' as const;
    return 'default' as const;
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(row.timestamp)}</span>
      ),
    },
    { key: 'userName', header: 'User' },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <Badge variant={actionBadgeVariant(row.action)}>
          {row.action.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'entityType',
      header: 'Entity Type',
      render: (row) => (
        <span className="text-xs text-slate-600">{row.entityType.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'entityId',
      header: 'Entity ID',
      render: (row) => (
        <span className="font-mono text-xs text-navy-700">{row.entityId || '—'}</span>
      ),
    },
    {
      key: 'changedFields',
      header: 'Changes',
      render: (row) => {
        if (!row.changedFields) return <span className="text-slate-400 text-xs">—</span>;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedRow(expandedRow === row.id ? null : row.id);
            }}
            className="flex items-center gap-1 text-xs text-navy-600 hover:text-navy-800"
          >
            {Object.keys(row.changedFields).length} field(s)
            {expandedRow === row.id ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        );
      },
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (row) => (
        <span className="font-mono text-xs text-slate-400">{row.ipAddress || '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete, immutable record of all system actions for 21 CFR Part 11 compliance
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Entity Types</option>
            {ENTITY_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Users</option>
            {USERS.filter(Boolean).map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Actions</option>
            {ACTION_TYPES.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              placeholder="From"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              placeholder="To"
            />
          </div>
        </div>
      </Card>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <Card noPadding>
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No audit log entries match your filters"
        />

        {/* Expandable row detail */}
        {expandedRow && (() => {
          const entry = filtered.find((e) => e.id === expandedRow);
          if (!entry || !entry.changedFields) return null;
          return (
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Changed Fields — {entry.entityId}
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Field</th>
                      <th className="px-4 py-2 text-left font-semibold text-red-500">Before</th>
                      <th className="px-4 py-2 text-left font-semibold text-emerald-500">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(entry.changedFields).map(([field, change]) => (
                      <tr key={field} className="border-b border-slate-100">
                        <td className="px-4 py-2 font-medium text-slate-700">{field}</td>
                        <td className="px-4 py-2 font-mono text-red-600">
                          {JSON.stringify(change.before)}
                        </td>
                        <td className="px-4 py-2 font-mono text-emerald-600">
                          {JSON.stringify(change.after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
