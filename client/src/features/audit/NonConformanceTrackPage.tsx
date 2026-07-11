import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const NC_PAGE_SIZE = 12;
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Drawer, Input, Popover, Select, Spin, message } from 'antd';
import dayjs from 'dayjs';
import {
  SlidersHorizontal,
  Check,
  CalendarClock,
  ClipboardList,
  ChevronRight,
  ShieldPlus,
  FileText,
  CircleDot,
  ShieldCheck,
} from 'lucide-react';
import {
  useNonConformances,
  useCreateCapa,
  useUpdateNcStatus,
  type FindingSeverity,
  type NonConformance,
  type NonConformanceStatus,
  type CapaType,
} from '@/lib/api/audit';
import { useHasPermission } from '@/stores/authStore';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { FindingSeverityBadge, NcStatusBadge } from './auditStatusBadge';

// ─── Filter-popover building blocks ──────────────────────────────────────────
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-medium capitalize transition-colors ${
        active
          ? 'border-gold-400 bg-gold-50 text-gold-800'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {active && <Check size={13} className="text-gold-600 shrink-0" />}
      {label}
      {count !== undefined && (
        <span
          className={`ml-0.5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
            active ? 'bg-gold-200/70 text-gold-800' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type TrackMode = 'register' | 'department' | 'severity' | 'status' | 'auditor';

const TRACKS: { key: TrackMode; label: string }[] = [
  { key: 'register', label: 'By Audit' },
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

// Summary of the audit that produced this group of non-conformances — four
// detail cards in a single row (audit ref, findings, status mix, CAPAs).
function AuditSummary({ items }: { items: NonConformance[] }) {
  const prog = items[0]?.finding.program;
  const total = items.length;
  const sev = (s: string) => items.filter((n) => n.severity === s).length;
  const open = items.filter((n) => n.status === 'OPEN').length;
  const closed = items.filter(
    (n) => n.status === 'CLOSED' || n.status === 'CANCELLED',
  ).length;
  const capas = items.filter(
    (n) => n.capa || n.capa_ticket || n.status === 'CAPA_RAISED',
  ).length;

  const cards = [
    {
      icon: <ClipboardList size={15} />,
      label: 'Audit',
      value: prog?.programNumber ?? '—',
      sub: prog?.register?.registerNumber ?? '',
      color: '#D97706',
    },
    {
      icon: <FileText size={15} />,
      label: 'Findings',
      value: String(total),
      sub: `${sev('CRITICAL')} critical · ${sev('MAJOR')} major · ${sev('MINOR')} minor`,
      color: '#2563EB',
    },
    {
      icon: <CircleDot size={15} />,
      label: 'Status',
      value: `${open} open`,
      sub: `${closed} closed · ${total - open - closed} in progress`,
      color: '#059669',
    },
    {
      icon: <ShieldCheck size={15} />,
      label: 'CAPAs Raised',
      value: String(capas),
      sub: capas ? `${capas} of ${total} linked` : 'none raised',
      color: '#7C3AED',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3.5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
        >
          <div className="flex items-center gap-1.5" style={{ color: c.color }}>
            {c.icon}
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              {c.label}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-lg font-bold text-gray-900 truncate">
            {c.value}
          </div>
          {c.sub && <div className="text-[11px] text-gray-400 truncate">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function NcCard({
  nc,
  canUpdate,
  canCreateCapa,
  statuses,
  onStatusChange,
  onRaiseCapa,
}: {
  nc: NonConformance;
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
  const [trackMode, setTrackMode] = useState<TrackMode>('register');
  const [statusFilter, setStatusFilter] = useState<NonConformanceStatus | 'ALL'>(
    'ALL',
  );
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'ALL'>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
  const [ncPage, setNcPage] = useState(1);
  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) + (severityFilter !== 'ALL' ? 1 : 0);
  const hasActiveFilters =
    trackMode !== 'register' || statusFilter !== 'ALL' || severityFilter !== 'ALL';
  const clearFilters = () => {
    setTrackMode('register');
    setStatusFilter('ALL');
    setSeverityFilter('ALL');
  };
  // Reset paging when filters change.
  useEffect(() => setNcPage(1), [trackMode, statusFilter, severityFilter]);

  const canUpdate = useHasPermission('non_conformance.update');
  const canCreateCapa = useHasPermission('capa.create');
  const updateStatus = useUpdateNcStatus();
  const [capaTarget, setCapaTarget] = useState<NonConformance | null>(null);

  // Fetch the full set once; filter client-side so the popover can show live
  // faceted counts for each status/severity option.
  const { data, isLoading } = useNonConformances();
  const allRows = data?.data ?? [];
  const rows = useMemo(
    () =>
      allRows.filter(
        (n) =>
          (statusFilter === 'ALL' || n.status === statusFilter) &&
          (severityFilter === 'ALL' || n.severity === severityFilter),
      ),
    [allRows, statusFilter, severityFilter],
  );

  // Faceted counts: each dimension counts against the *other* active filter, so
  // the numbers reflect what you'd actually get if you picked that option.
  const bySeverity = useMemo(
    () =>
      severityFilter === 'ALL'
        ? allRows
        : allRows.filter((n) => n.severity === severityFilter),
    [allRows, severityFilter],
  );
  const byStatus = useMemo(
    () =>
      statusFilter === 'ALL'
        ? allRows
        : allRows.filter((n) => n.status === statusFilter),
    [allRows, statusFilter],
  );
  const statusCount = (s: NonConformanceStatus | 'ALL') =>
    s === 'ALL' ? bySeverity.length : bySeverity.filter((n) => n.status === s).length;
  const severityCount = (s: FindingSeverity | 'ALL') =>
    s === 'ALL' ? byStatus.length : byStatus.filter((n) => n.severity === s).length;

  // Group rows by the active track dimension
  const groups = useMemo(() => {
    const keyOf = (n: NonConformance): string => {
      switch (trackMode) {
        case 'register':
          return n.finding.program?.register?.title ?? 'Unlinked';
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

  // Paginate by group (audit) so each audit renders as one collapsible panel
  // with all its non-conformances wrapped inside.
  const ncTotalPages = Math.max(1, Math.ceil(groups.length / NC_PAGE_SIZE));
  const pagedGroups = groups.slice((ncPage - 1) * NC_PAGE_SIZE, ncPage * NC_PAGE_SIZE);

  // Which audit panels are collapsed. Empty = all expanded; clicking a header
  // toggles that audit open/closed.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

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
      {/* Frosted backdrop behind the filter popover (portaled to body so it
          reliably covers the page and sits just under the popover). */}
      {filterOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[1090] bg-slate-900/20 backdrop-blur-sm transition-opacity"
            onClick={() => setFilterOpen(false)}
          />,
          document.body,
        )}

      {/* Single toolbar row: title + filter. */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Non-Conformance</h2>
          <p className="text-xs text-gray-500">
            Findings promoted to non-conformances — track and close via CAPA.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover
            open={filterOpen}
            onOpenChange={setFilterOpen}
            trigger="click"
            placement="bottomRight"
            arrow={false}
            zIndex={1100}
            styles={{
              body: {
                padding: 0,
                boxShadow: '0 12px 40px -8px rgba(0,0,0,0.25)',
              },
            }}
            content={
              <div className="w-[340px]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">Filters</span>
                  <button
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="text-xs font-medium text-gold-700 hover:text-gold-800 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Clear all
                  </button>
                </div>

                {/* Body */}
                <div className="px-4 py-3 space-y-3.5 max-h-[55vh] overflow-y-auto">
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
                  <div className="h-px bg-gray-100" />
                  <FilterGroup label="Status">
                    <FilterPill
                      label="All"
                      active={statusFilter === 'ALL'}
                      count={statusCount('ALL')}
                      onClick={() => setStatusFilter('ALL')}
                    />
                    {NC_STATUSES.map((s) => (
                      <FilterPill
                        key={s}
                        label={s.replace(/_/g, ' ')}
                        active={statusFilter === s}
                        count={statusCount(s)}
                        onClick={() => setStatusFilter(s)}
                      />
                    ))}
                  </FilterGroup>
                  <div className="h-px bg-gray-100" />
                  <FilterGroup label="Severity">
                    {(['ALL', 'MINOR', 'MAJOR', 'CRITICAL', 'OBSERVATION'] as const).map((s) => (
                      <FilterPill
                        key={s}
                        label={s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                        active={severityFilter === s}
                        count={severityCount(s)}
                        onClick={() => setSeverityFilter(s as FindingSeverity | 'ALL')}
                      />
                    ))}
                  </FilterGroup>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
                  <span className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-900 tabular-nums">
                      {rows.length}
                    </span>{' '}
                    matching
                  </span>
                  <Button size="small" type="primary" onClick={() => setFilterOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            }
          >
            <Button icon={<SlidersHorizontal size={14} />}>
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-gold-100 text-gold-700 text-[10px] font-semibold w-4 h-4">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </Popover>
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
        <>
          <div className="space-y-3">
            {pagedGroups.map(([key, items]) => {
              const isOpen = !collapsed.has(key);
              return (
                <section
                  key={key}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <ChevronRight
                      size={16}
                      className={`shrink-0 text-gray-400 transition-transform ${
                        isOpen ? 'rotate-90' : ''
                      }`}
                    />
                    <ClipboardList size={15} className="shrink-0 text-gold-600" />
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{key}</h3>
                    <span className="inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold px-2 h-5 shrink-0">
                      {items.length}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 p-3.5 bg-gray-50/40">
                      {trackMode === 'register' && <AuditSummary items={items} />}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                        {items.map((nc) => (
                          <NcCard
                            key={nc.id}
                            nc={nc}
                            canUpdate={canUpdate}
                            canCreateCapa={canCreateCapa}
                            statuses={NC_STATUSES}
                            onStatusChange={handleStatusChange}
                            onRaiseCapa={() => setCapaTarget(nc)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {groups.length > NC_PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                Showing {(ncPage - 1) * NC_PAGE_SIZE + 1}–
                {Math.min(ncPage * NC_PAGE_SIZE, groups.length)} of {groups.length} audits
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

      <RaiseCapaDrawer
        nc={capaTarget}
        onClose={() => setCapaTarget(null)}
      />
    </>
  );
}

/* ─── Raise CAPA drawer: create a first-class CAPA from this non-conformance ─── */

const CAPA_TYPES: CapaType[] = ['CORRECTIVE', 'PREVENTIVE', 'BOTH'];

const CAPA_TYPE_HINT: Record<CapaType, string> = {
  CORRECTIVE: 'Fix this specific non-conformance.',
  PREVENTIVE: 'Stop it from recurring elsewhere.',
  BOTH: 'Corrective + preventive together.',
};

function DrawerField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function RaiseCapaDrawer({
  nc,
  onClose,
}: {
  nc: NonConformance | null;
  onClose: () => void;
}) {
  const nav = useNavigate();
  const createMut = useCreateCapa();
  const { data: usersData } = useUserDirectory();
  const { data: deptsResp } = useDepartments({ pageSize: 200 });
  const users = usersData?.items ?? [];
  const departments = deptsResp?.items ?? [];

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CapaType>('CORRECTIVE');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<string | undefined>();

  // Reset the form each time the drawer opens for a different NC, seeding the
  // title and department from the source finding.
  const seededFor = useMemo(() => nc?.id, [nc]);
  useEffect(() => {
    if (nc) {
      setTitle(`CAPA for ${nc.nc_number} — ${nc.finding.description ?? ''}`.slice(0, 160));
      setType('CORRECTIVE');
      setDescription('');
      setOwnerId(undefined);
      setDepartmentId(nc.department?.id);
      setDueDate(undefined);
    }
  }, [seededFor, nc]);

  const submit = async () => {
    if (!nc) return;
    try {
      const res = await createMut.mutateAsync({
        title: title.trim() || `CAPA for ${nc.nc_number}`,
        type,
        description: description.trim() || null,
        owner_id: ownerId ?? null,
        department_id: departmentId ?? null,
        due_date: dueDate ?? null,
        non_conformance_id: nc.id,
      });
      message.success('CAPA raised — NC moved to CAPA_RAISED');
      onClose();
      const id = (res as { data?: { id?: string } })?.data?.id;
      if (id) nav(`/audit/capa/${id}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Drawer
      title={nc ? `Raise CAPA — ${nc.nc_number}` : 'Raise CAPA'}
      width={480}
      open={!!nc}
      onClose={onClose}
      destroyOnClose
      styles={{ body: { paddingTop: 16 }, footer: { padding: '12px 24px' } }}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            icon={<ShieldPlus size={14} />}
            loading={createMut.isPending}
            onClick={submit}
          >
            Raise CAPA
          </Button>
        </div>
      }
    >
      {nc && (
        <>
          {/* Source non-conformance context */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 mb-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-emerald-700">
                {nc.nc_number}
              </span>
              <FindingSeverityBadge severity={nc.severity as FindingSeverity} />
            </div>
            <p className="text-sm text-gray-800 mt-1.5 line-clamp-2">
              {nc.finding.description ?? '—'}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
              <span className="font-mono">{nc.finding.findingNumber}</span>
              {nc.finding.program?.programNumber && (
                <span className="inline-flex items-center gap-1">
                  <ClipboardList size={11} />
                  {nc.finding.program.programNumber}
                </span>
              )}
              {nc.finding.program?.register?.registerNumber && (
                <span className="font-mono">{nc.finding.program.register.registerNumber}</span>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Creates a CAPA linked to this non-conformance and moves it to{' '}
            <span className="font-mono">CAPA_RAISED</span>. You'll land in the CAPA workspace to
            record root cause and actions.
          </p>

          <div className="space-y-4">
            <DrawerField label="Title" required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="CAPA title"
                maxLength={200}
              />
            </DrawerField>

            <DrawerField label="Type" required hint={CAPA_TYPE_HINT[type]}>
              <Select
                value={type}
                onChange={setType}
                options={CAPA_TYPES.map((t) => ({ value: t, label: t }))}
                className="w-full"
              />
            </DrawerField>

            <div className="grid grid-cols-2 gap-3">
              <DrawerField label="Owner">
                <Select
                  value={ownerId}
                  onChange={setOwnerId}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Assign owner"
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                  className="w-full"
                />
              </DrawerField>
              <DrawerField label="Department">
                <Select
                  value={departmentId}
                  onChange={setDepartmentId}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Owning dept."
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  className="w-full"
                />
              </DrawerField>
            </div>

            <DrawerField label="Target due date" hint="When the CAPA should be closed by.">
              <DatePicker
                value={dueDate ? dayjs(dueDate) : null}
                onChange={(d) => setDueDate(d ? d.format('YYYY-MM-DD') : undefined)}
                className="w-full"
                disabledDate={(d) => d.isBefore(dayjs().startOf('day'))}
              />
            </DrawerField>

            <DrawerField label="Description" hint="Optional context, scope, or initial notes.">
              <Input.TextArea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the problem and any immediate containment…"
                maxLength={4000}
                showCount
              />
            </DrawerField>
          </div>
        </>
      )}
    </Drawer>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message ?? 'Operation failed'
  );
}
