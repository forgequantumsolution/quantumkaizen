import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal, Select, Spin, Table, message } from 'antd';
import {
  useNonConformances,
  useComplianceResults,
  useCreateCapa,
  useUpdateNcStatus,
  type FindingSeverity,
  type NonConformance,
  type NonConformanceStatus,
  type ComplianceResult,
  type ComplianceResultRow,
  type CapaType,
} from '@/lib/api/audit';
import { COMPLIANCE_OPTIONS } from '@/features/forms/fieldCatalog';
import { useHasPermission } from '@/stores/authStore';
import { FindingSeverityBadge, NcStatusBadge } from './auditStatusBadge';

const COMPLIANCE_META: Record<ComplianceResult, { label: string; color: string }> =
  Object.fromEntries(
    COMPLIANCE_OPTIONS.map((o) => [o.value, { label: o.label, color: o.color }]),
  ) as Record<ComplianceResult, { label: string; color: string }>;

function DispositionBadge({ result }: { result: ComplianceResult }) {
  const meta = COMPLIANCE_META[result];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

type TrackMode = 'department' | 'severity' | 'status' | 'auditor';

const TRACKS: { key: TrackMode; label: string }[] = [
  { key: 'department', label: 'By Department' },
  { key: 'severity', label: 'By Severity' },
  { key: 'status', label: 'By Status' },
  { key: 'auditor', label: 'By Auditor' },
];

const NC_STATUSES: NonConformanceStatus[] = [
  'OPEN',
  'CAPA_RAISED',
  'IN_PROGRESS',
  'VERIFICATION',
  'CLOSED',
  'CANCELLED',
];

export default function NonConformanceTrackPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<'nc' | 'all'>('nc');
  const [trackMode, setTrackMode] = useState<TrackMode>('department');
  const [statusFilter, setStatusFilter] = useState<NonConformanceStatus | 'ALL'>(
    'ALL',
  );
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'ALL'>('ALL');

  const canUpdate = useHasPermission('non_conformance.update');
  const canCreateCapa = useHasPermission('capa.create');
  const updateStatus = useUpdateNcStatus();
  const [capaTarget, setCapaTarget] = useState<NonConformance | null>(null);

  const { data, isLoading } = useNonConformances({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    severity: severityFilter === 'ALL' ? undefined : severityFilter,
  });
  const rows = data?.data ?? [];

  // Read-only view of every checklist disposition from closed audit tickets.
  const { data: crData, isLoading: crLoading } = useComplianceResults();
  const complianceRows = crData?.data ?? [];

  // Group rows by the active track dimension
  const groups = useMemo(() => {
    const keyOf = (n: NonConformance): string => {
      switch (trackMode) {
        case 'department':
          return n.department?.name ?? 'Unassigned';
        case 'severity':
          return n.severity;
        case 'status':
          return n.status;
        case 'auditor':
          return 'All Auditors'; // backend doesn't carry auditor on NC; placeholder
      }
    };
    const map = new Map<string, NonConformance[]>();
    rows.forEach((n) => {
      const k = keyOf(n);
      const arr = map.get(k) ?? [];
      arr.push(n);
      map.set(k, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, trackMode]);

  const handleStatusChange = async (id: string, status: NonConformanceStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      qc.invalidateQueries({ queryKey: ['audit', 'compliance-results'] });
      message.success(`Status set to ${status}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Non-Conformance</h2>
          <p className="text-xs text-gray-500">
            {view === 'nc'
              ? 'Findings promoted to non-conformances — track and close via CAPA.'
              : 'Every checklist disposition from closed audits. Only non-conformances are actionable.'}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(
            [
              { key: 'nc', label: 'Non-Conformances' },
              { key: 'all', label: 'All Compliance Results' },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === v.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'all' ? (
        <ComplianceResultsView
          rows={complianceRows}
          loading={crLoading}
          canUpdate={canUpdate}
          statuses={NC_STATUSES}
          onStatusChange={handleStatusChange}
        />
      ) : (
      <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {TRACKS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTrackMode(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                trackMode === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: 'ALL', label: 'All statuses' },
              ...NC_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
            ]}
          />
          <Select
            value={severityFilter}
            onChange={setSeverityFilter}
            style={{ width: 140 }}
            options={[
              { value: 'ALL', label: 'All severities' },
              { value: 'MINOR', label: 'Minor' },
              { value: 'MAJOR', label: 'Major' },
              { value: 'CRITICAL', label: 'Critical' },
              { value: 'OBSERVATION', label: 'Observation' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-24 text-center text-sm text-gray-400">
          No non-conformances match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([trackKey, items]) => (
            <div
              key={trackKey}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">
                  {trackKey}
                </div>
                <span className="text-[11px] text-gray-500">
                  {items.length} NC{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <Table<NonConformance>
                size="small"
                rowKey="id"
                dataSource={items}
                pagination={false}
                columns={[
                  {
                    title: 'NC #',
                    dataIndex: 'nc_number',
                    width: 130,
                    render: (v: string) => (
                      <span className="font-mono text-emerald-700">{v}</span>
                    ),
                  },
                  {
                    title: 'Severity',
                    dataIndex: 'severity',
                    width: 100,
                    render: (v: FindingSeverity) => <FindingSeverityBadge severity={v} />,
                  },
                  {
                    title: 'Status',
                    width: 140,
                    render: (_: unknown, r) =>
                      canUpdate ? (
                        <Select
                          size="small"
                          value={r.status}
                          onChange={(v) => handleStatusChange(r.id, v)}
                          options={NC_STATUSES.map((s) => ({
                            value: s,
                            label: s.replace(/_/g, ' '),
                          }))}
                          style={{ width: '100%' }}
                        />
                      ) : (
                        <NcStatusBadge status={r.status} />
                      ),
                  },
                  {
                    title: 'From Finding',
                    render: (_: unknown, r) => (
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-gray-700">
                          {r.finding.findingNumber}
                        </div>
                        <div className="text-sm text-gray-900 truncate">
                          {r.finding.description ?? '—'}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Audit',
                    width: 200,
                    render: (_: unknown, r) =>
                      r.finding.program?.register ? (
                        <Link
                          to={`/audit/program/${r.finding.program.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {r.finding.program.register.title}
                        </Link>
                      ) : (
                        '—'
                      ),
                  },
                  {
                    title: 'Due',
                    dataIndex: 'due_date',
                    width: 110,
                    render: (v: string | null) =>
                      v ? new Date(v).toLocaleDateString() : '—',
                  },
                  {
                    title: 'CAPA',
                    width: 150,
                    render: (_: unknown, r) =>
                      r.capa ? (
                        <Link
                          to={`/audit/capa/${r.capa.id}`}
                          className="font-mono text-blue-600 hover:underline"
                        >
                          {r.capa.capaNumber}
                        </Link>
                      ) : r.capa_ticket ? (
                        <Link
                          to={`/tickets/${r.capa_ticket.id}`}
                          className="font-mono text-amber-700 hover:underline"
                        >
                          {r.capa_ticket.uniqueId}
                        </Link>
                      ) : canCreateCapa ? (
                        <Button size="small" onClick={() => setCapaTarget(r)}>
                          Raise CAPA
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">Not raised</span>
                      ),
                  },
                ]}
              />
            </div>
          ))}
        </div>
      )}
      </>
      )}

      <RaiseCapaModal
        nc={capaTarget}
        onClose={() => setCapaTarget(null)}
      />
    </>
  );
}

/* ─── All compliance results: read-only, NC rows actionable via status ─── */

function ComplianceResultsView({
  rows,
  loading,
  canUpdate,
  statuses,
  onStatusChange,
}: {
  rows: ComplianceResultRow[];
  loading: boolean;
  canUpdate: boolean;
  statuses: NonConformanceStatus[];
  onStatusChange: (id: string, status: NonConformanceStatus) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="py-24 text-center text-sm text-gray-400">
        No compliance results yet. They appear here once an audit ticket with a
        marked checklist is closed.
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <Table<ComplianceResultRow>
        size="small"
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        columns={[
          {
            title: 'Disposition',
            dataIndex: 'result',
            width: 150,
            render: (v: ComplianceResult) => <DispositionBadge result={v} />,
          },
          {
            title: 'Checklist Item',
            render: (_: unknown, r) => (
              <div className="min-w-0">
                <div className="text-sm text-gray-900 truncate">{r.label}</div>
                <div className="text-[11px] text-gray-400 truncate">{r.section}</div>
              </div>
            ),
          },
          {
            title: 'Audit',
            width: 200,
            render: (_: unknown, r) => (
              <Link
                to={`/audit/program/${r.audit.program_id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {r.audit.title}
              </Link>
            ),
          },
          {
            title: 'NC #',
            width: 130,
            render: (_: unknown, r) =>
              r.nc ? (
                <span className="font-mono text-emerald-700">{r.nc.nc_number}</span>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              ),
          },
          {
            title: 'Action',
            width: 150,
            render: (_: unknown, r) =>
              r.nc ? (
                canUpdate ? (
                  <Select
                    size="small"
                    value={r.nc.status}
                    onChange={(v) => onStatusChange(r.nc!.id, v)}
                    options={statuses.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <NcStatusBadge status={r.nc.status} />
                )
              ) : (
                <span className="text-xs text-gray-400">No action</span>
              ),
          },
        ]}
      />
    </div>
  );
}

/* ─── Raise CAPA modal: create a first-class CAPA from this non-conformance ─── */

const CAPA_TYPES: CapaType[] = ['CORRECTIVE', 'PREVENTIVE', 'BOTH'];

function RaiseCapaModal({
  nc,
  onClose,
}: {
  nc: NonConformance | null;
  onClose: () => void;
}) {
  const nav = useNavigate();
  const createMut = useCreateCapa();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CapaType>('CORRECTIVE');

  // Seed the title from the source finding when the modal opens for a new NC.
  const seededFor = useMemo(() => nc?.id, [nc]);
  const effectiveTitle =
    title || (nc ? `CAPA for ${nc.nc_number} — ${nc.finding.description ?? ''}`.slice(0, 160) : '');

  const submit = async () => {
    if (!nc) return;
    try {
      const res = await createMut.mutateAsync({
        title: effectiveTitle.trim() || `CAPA for ${nc.nc_number}`,
        type,
        non_conformance_id: nc.id,
      });
      message.success('CAPA raised — NC moved to CAPA_RAISED');
      setTitle('');
      onClose();
      const id = (res as { data?: { id?: string } })?.data?.id;
      if (id) nav(`/audit/capa/${id}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Modal
      key={seededFor}
      title={nc ? `Raise CAPA for ${nc.nc_number}` : 'Raise CAPA'}
      open={!!nc}
      onCancel={() => {
        setTitle('');
        onClose();
      }}
      onOk={submit}
      okText="Raise CAPA"
      okButtonProps={{ loading: createMut.isPending }}
    >
      <p className="text-sm text-gray-600 mb-3">
        Creates a CAPA linked to this non-conformance and sets its status to{' '}
        <span className="font-mono">CAPA_RAISED</span>. You'll be taken to the CAPA workspace to
        record root cause and actions.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Title</label>
          <Input
            value={effectiveTitle}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="CAPA title"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Type</label>
          <Select
            value={type}
            onChange={setType}
            options={CAPA_TYPES.map((t) => ({ value: t, label: t }))}
            className="w-full"
          />
        </div>
      </div>
    </Modal>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message ?? 'Operation failed'
  );
}
