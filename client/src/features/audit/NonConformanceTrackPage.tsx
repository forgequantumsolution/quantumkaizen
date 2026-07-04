import { useEffect, useMemo, useState } from 'react';

const NC_PAGE_SIZE = 12;
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal, Select, Spin, message } from 'antd';
import { SlidersHorizontal, Check, CalendarClock, ClipboardList, ShieldPlus } from 'lucide-react';
import { DataTable } from '@/components/ui';
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

// ─── Filter-modal building blocks ───────────────────────────────────────────
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
        active
          ? 'border-gold-400 bg-gold-50 text-gold-800'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
      {active && <Check size={14} className="text-gold-600 shrink-0" />}
    </button>
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

// Severity → left-accent colour for the NC card.
const SEV_ACCENT: Record<string, string> = {
  CRITICAL: '#DC2626',
  MAJOR: '#D97706',
  MINOR: '#2563EB',
  OBSERVATION: '#64748B',
};

function NcCard({
  nc,
  groupLabel,
  canUpdate,
  canCreateCapa,
  statuses,
  onStatusChange,
  onRaiseCapa,
}: {
  nc: NonConformance;
  groupLabel?: string;
  canUpdate: boolean;
  canCreateCapa: boolean;
  statuses: NonConformanceStatus[];
  onStatusChange: (id: string, status: NonConformanceStatus) => void;
  onRaiseCapa: () => void;
}) {
  const accent = SEV_ACCENT[nc.severity] ?? '#64748B';
  const closed = nc.status === 'CLOSED' || nc.status === 'CANCELLED';
  const overdue = !!nc.due_date && !closed && new Date(nc.due_date) < new Date();

  return (
    <div
      className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="p-3.5 flex-1">
        {groupLabel && (
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 truncate">
            {groupLabel}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-bold text-emerald-700">{nc.nc_number}</span>
          <FindingSeverityBadge severity={nc.severity as FindingSeverity} />
        </div>

        <div className="mt-2.5">
          <div className="font-mono text-[10px] text-gray-400">{nc.finding.findingNumber}</div>
          <p className="text-sm text-gray-900 mt-0.5 line-clamp-2">
            {nc.finding.description ?? '—'}
          </p>
        </div>

        {nc.finding.program?.register && (
          <Link
            to={`/audit/program/${nc.finding.program.id}`}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline max-w-full"
          >
            <ClipboardList size={12} className="shrink-0" />
            <span className="truncate">{nc.finding.program.register.title}</span>
          </Link>
        )}

        <div className="mt-3">
          {canUpdate ? (
            <Select
              size="small"
              value={nc.status}
              onChange={(v) => onStatusChange(nc.id, v)}
              options={statuses.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
              style={{ width: '100%' }}
            />
          ) : (
            <NcStatusBadge status={nc.status} />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-gray-100 bg-gray-50/50">
        <span
          className={`inline-flex items-center gap-1.5 text-xs ${
            overdue ? 'text-red-600 font-medium' : 'text-gray-500'
          }`}
          title={overdue ? 'Overdue' : undefined}
        >
          <CalendarClock size={13} />
          {nc.due_date ? new Date(nc.due_date).toLocaleDateString() : 'No due date'}
        </span>

        {nc.capa ? (
          <Link
            to={`/audit/capa/${nc.capa.id}`}
            className="font-mono text-xs text-blue-600 hover:underline"
          >
            {nc.capa.capaNumber}
          </Link>
        ) : nc.capa_ticket ? (
          <Link
            to={`/tickets/${nc.capa_ticket.id}`}
            className="font-mono text-xs text-amber-700 hover:underline"
          >
            {nc.capa_ticket.uniqueId}
          </Link>
        ) : canCreateCapa ? (
          <Button size="small" icon={<ShieldPlus size={12} />} onClick={onRaiseCapa}>
            Raise CAPA
          </Button>
        ) : (
          <span className="text-xs text-gray-400">No CAPA</span>
        )}
      </div>
    </div>
  );
}

export default function NonConformanceTrackPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<'nc' | 'all'>('nc');
  const [trackMode, setTrackMode] = useState<TrackMode>('department');
  const [statusFilter, setStatusFilter] = useState<NonConformanceStatus | 'ALL'>(
    'ALL',
  );
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'ALL'>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
  const [ncPage, setNcPage] = useState(1);
  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) + (severityFilter !== 'ALL' ? 1 : 0);
  // Reset paging when filters change.
  useEffect(() => setNcPage(1), [trackMode, statusFilter, severityFilter, view]);

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
  // Seed/demo audits (prefixed "[SEED]") are excluded from the performance view.
  const { data: crData, isLoading: crLoading } = useComplianceResults();
  const complianceRows = (crData?.data ?? []).filter(
    (r) => !r.audit.title.startsWith('[SEED]'),
  );

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

  // Flatten groups into a single list (each item keeps its group label) so the
  // cards flow across the full width and can be paginated together.
  const flatNcs = useMemo(
    () => groups.flatMap(([key, items]) => items.map((nc) => ({ nc, group: key }))),
    [groups],
  );
  const ncTotalPages = Math.max(1, Math.ceil(flatNcs.length / NC_PAGE_SIZE));
  const pagedNcs = flatNcs.slice((ncPage - 1) * NC_PAGE_SIZE, ncPage * NC_PAGE_SIZE);

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
      {/* Single toolbar row: title + view toggle + filter. */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Non-Conformance</h2>
          <p className="text-xs text-gray-500">
            {view === 'nc'
              ? 'Findings promoted to non-conformances — track and close via CAPA.'
              : 'Every checklist disposition from closed audits. Only non-conformances are actionable.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          {view === 'nc' && (
            <Button icon={<SlidersHorizontal size={14} />} onClick={() => setFilterOpen(true)}>
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-gold-100 text-gold-700 text-[10px] font-semibold w-4 h-4">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Filter modal — group-by + status + severity. */}
      <Modal
        open={filterOpen}
        onCancel={() => setFilterOpen(false)}
        title="Filter non-conformances"
        footer={
          <div className="flex items-center justify-between">
            <Button
              type="text"
              onClick={() => {
                setTrackMode('department');
                setStatusFilter('ALL');
                setSeverityFilter('ALL');
              }}
              disabled={
                trackMode === 'department' &&
                statusFilter === 'ALL' &&
                severityFilter === 'ALL'
              }
            >
              Clear
            </Button>
            <Button type="primary" onClick={() => setFilterOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <FilterGroup label="Group by">
            {TRACKS.map((t) => (
              <FilterPill
                key={t.key}
                label={t.label}
                active={trackMode === t.key}
                onClick={() => setTrackMode(t.key)}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Status">
            <FilterPill
              label="All statuses"
              active={statusFilter === 'ALL'}
              onClick={() => setStatusFilter('ALL')}
            />
            {NC_STATUSES.map((s) => (
              <FilterPill
                key={s}
                label={s.replace(/_/g, ' ')}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Severity">
            {(['ALL', 'MINOR', 'MAJOR', 'CRITICAL', 'OBSERVATION'] as const).map((s) => (
              <FilterPill
                key={s}
                label={s === 'ALL' ? 'All severities' : s.charAt(0) + s.slice(1).toLowerCase()}
                active={severityFilter === s}
                onClick={() => setSeverityFilter(s as FindingSeverity | 'ALL')}
              />
            ))}
          </FilterGroup>
        </div>
      </Modal>

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

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-24 text-center text-sm text-gray-400">
          No non-conformances match the current filters.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {pagedNcs.map(({ nc, group }) => (
              <NcCard
                key={nc.id}
                nc={nc}
                groupLabel={group}
                canUpdate={canUpdate}
                canCreateCapa={canCreateCapa}
                statuses={NC_STATUSES}
                onStatusChange={handleStatusChange}
                onRaiseCapa={() => setCapaTarget(nc)}
              />
            ))}
          </div>

          {flatNcs.length > NC_PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                Showing {(ncPage - 1) * NC_PAGE_SIZE + 1}–
                {Math.min(ncPage * NC_PAGE_SIZE, flatNcs.length)} of {flatNcs.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setNcPage((p) => Math.max(1, p - 1))}
                  disabled={ncPage === 1}
                  className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: ncTotalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, ncPage - 3), Math.max(0, ncPage - 3) + 5)
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setNcPage(p)}
                      className={`w-7 h-7 text-xs rounded border transition-colors ${
                        p === ncPage
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  onClick={() => setNcPage((p) => Math.min(ncTotalPages, p + 1))}
                  disabled={ncPage >= ncTotalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
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
  // Filter by the audit's user (auditor). Options are the distinct auditors
  // present in the results, so no extra lookup is needed.
  const [userId, setUserId] = useState<string>('');
  const auditors = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.auditor) m.set(r.auditor.id, r.auditor.name);
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [rows]);
  const filteredRows = userId ? rows.filter((r) => r.auditor?.id === userId) : rows;

  // Compliance-performance breakdown across every disposition.
  const PERF: ComplianceResult[] = [
    'COMPLIANT',
    'NON_CONFORMANCE',
    'OBSERVATION',
    'NOT_APPLICABLE',
  ];
  const counts: Record<string, number> = {};
  for (const r of filteredRows) counts[r.result] = (counts[r.result] ?? 0) + 1;
  const total = filteredRows.length;

  return (
    <>
      {/* Compliance performance summary */}
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Compliance Performance</h3>
            <span className="text-[11px] text-gray-500">{total} results</span>
          </div>
          <Select
            value={userId || 'ALL'}
            onChange={(v) => setUserId(v === 'ALL' ? '' : v)}
            style={{ width: 200 }}
            options={[
              { value: 'ALL', label: 'All auditors' },
              ...auditors.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PERF.map((k) => {
            const meta = COMPLIANCE_META[k] ?? { label: k, color: '#64748B' };
            const val = counts[k] ?? 0;
            const pct = total ? Math.round((val / total) * 100) : 0;
            return (
              <div
                key={k}
                className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: meta.color }}
                  />
                  <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-bold tabular-nums" style={{ color: meta.color }}>
                    {val}
                  </span>
                  <span className="text-[11px] text-gray-400">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <DataTable<ComplianceResultRow>
        data={filteredRows}
        isLoading={loading}
        pageSize={20}
        emptyMessage="No compliance results yet. They appear here once an audit ticket with a marked checklist is closed."
        columns={[
          {
            key: 'result',
            header: 'Disposition',
            sortable: false,
            render: (r) => <DispositionBadge result={r.result as ComplianceResult} />,
          },
          {
            key: 'label',
            header: 'Checklist Item',
            render: (r) => (
              <div className="min-w-0">
                <div className="text-sm text-gray-900 truncate">{r.label}</div>
                <div className="text-[11px] text-gray-400 truncate">{r.section}</div>
              </div>
            ),
          },
          {
            key: 'audit',
            header: 'Audit',
            sortable: false,
            render: (r) => (
              <Link
                to={`/audit/program/${r.audit.program_id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {r.audit.title}
              </Link>
            ),
          },
          {
            key: 'nc_number',
            header: 'NC #',
            sortable: false,
            render: (r) =>
              r.nc ? (
                <span className="font-mono text-emerald-700">{r.nc.nc_number}</span>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              ),
          },
          {
            key: 'action',
            header: 'Action',
            sortable: false,
            render: (r) =>
              r.nc ? (
                canUpdate ? (
                  <Select
                    size="small"
                    value={r.nc.status}
                    onChange={(v) => onStatusChange(r.nc!.id, v)}
                    options={statuses.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                    style={{ width: '100%', minWidth: 140 }}
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
    </>
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
