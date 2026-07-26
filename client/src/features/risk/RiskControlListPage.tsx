/**
 * Cross-risk control tracker — every risk-reduction measure in the organisation
 * in one queue, regardless of which risk or register it hangs off.
 *
 * The reason this page exists separately from the risk workspace: controls are
 * worked by owners, not by risk. A QA lead chasing overdue mitigations does not
 * want to open forty risks to find them, so the overdue set is one click away
 * and overdue rows are flagged in the table itself.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button as AntButton,
  DatePicker,
  Drawer,
  Form,
  Input as AntInput,
  Select as AntSelect,
  Tooltip,
  message,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { BadgeCheck, Download, ExternalLink, ListChecks, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { Badge, DataTable, KpiCard, type Column } from '@/components/ui';
import { exportToCSV } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useHasPermission } from '@/stores/authStore';
import { useUserDirectory } from '@/features/admin/users/hooks';
import {
  useRiskControls,
  useRiskControlStatusCounts,
  useRiskRegisters,
  useVerifyControl,
  CONTROL_HIERARCHY_LABELS,
  CONTROL_STATUS_LABELS,
  CONTROL_TYPE_LABELS,
  type ControlHierarchy,
  type ControlStatus,
  type ControlType,
  type RiskControl,
} from '@/lib/api/risk';
import { ControlStatusBadge } from './riskStatusBadge';
import FilterBar, { FilterField } from '@/components/shared/FilterBar';

const PAGE_SIZE = 15;

const CONTROL_STATUSES = Object.keys(CONTROL_STATUS_LABELS) as ControlStatus[];
const CONTROL_TYPES = Object.keys(CONTROL_TYPE_LABELS) as ControlType[];
const CONTROL_HIERARCHIES = Object.keys(CONTROL_HIERARCHY_LABELS) as ControlHierarchy[];

/**
 * `dir` is the direction that makes each key useful on arrival — soonest-due
 * first, newest-created first. Picking a sort key resets to it; the direction
 * toggle then overrides it explicitly.
 */
const SORTS = [
  { value: 'dueDate', label: 'Due date', dir: 'asc' },
  { value: 'createdAt', label: 'Created', dir: 'desc' },
  { value: 'status', label: 'Status', dir: 'asc' },
  { value: 'controlNumber', label: 'Control number', dir: 'asc' },
] as const;

/**
 * Due-date presets. The API filters on `dueBefore` only, so every preset is
 * expressed as one horizon — there is deliberately no "next 30 days *excluding*
 * overdue" preset, because the endpoint cannot express a lower bound and a
 * client-side trim would silently disagree with the row count.
 */
const DUE_HORIZONS = [
  { value: '7', label: 'Due within 7 days' },
  { value: '30', label: 'Due within 30 days' },
  { value: '90', label: 'Due within 90 days' },
] as const;

/** Bar/legend colours for the status mix — mirrors ControlStatusBadge's tones. */
const STATUS_BAR_COLOR: Record<ControlStatus, string> = {
  PLANNED: '#94A3B8',
  IN_PROGRESS: '#3B82F6',
  IMPLEMENTED: '#6366F1',
  VERIFIED: '#10B981',
  INEFFECTIVE: '#EF4444',
  CANCELLED: '#CBD5E1',
};

const horizonToIso = (days: string) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const extractErr = (err: unknown): string => {
  const res = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
    ?.response?.data;
  return res?.error?.message ?? res?.message ?? 'Operation failed';
};

export default function RiskControlListPage() {
  const nav = useNavigate();
  const canApprove = useHasPermission('risk_control.approve');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ControlStatus | undefined>();
  const [type, setType] = useState<ControlType | undefined>();
  const [hierarchy, setHierarchy] = useState<ControlHierarchy | undefined>();
  const [registerId, setRegisterId] = useState<string | undefined>();
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [overdue, setOverdue] = useState(false);
  const [dueHorizon, setDueHorizon] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<(typeof SORTS)[number]['value']>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [verifyTarget, setVerifyTarget] = useState<RiskControl | null>(null);

  const debouncedSearch = useDebouncedValue(search, 400);
  useEffect(
    () => setPage(1),
    [debouncedSearch, status, type, hierarchy, registerId, ownerId, overdue, dueHorizon, sortBy, sortDir],
  );

  const { data, isLoading } = useRiskControls({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status,
    type,
    hierarchy,
    registerId,
    ownerId,
    overdue: overdue || undefined,
    dueBefore: dueHorizon ? horizonToIso(dueHorizon) : undefined,
    sortBy,
    sortDir,
  });

  // A second, count-only query gives an honest overdue KPI even while the main
  // table is filtered to something else.
  const { data: overduePage } = useRiskControls({ overdue: true, page: 1, pageSize: 1 });

  /**
   * Status breakdown across the whole filtered result, not just the loaded page.
   * `status` is deliberately excluded from the base so the bar keeps showing the
   * full distribution while one band is selected — otherwise picking a status
   * would collapse the chart that is meant to let you pick another.
   */
  const { counts: statusCounts } = useRiskControlStatusCounts(CONTROL_STATUSES, {
    search: debouncedSearch || undefined,
    type,
    hierarchy,
    registerId,
    ownerId,
    overdue: overdue || undefined,
    dueBefore: dueHorizon ? horizonToIso(dueHorizon) : undefined,
  });
  const { data: registerPage } = useRiskRegisters({ isActive: true, page: 1, pageSize: 200 });
  const { data: directory } = useUserDirectory();

  const rows = data?.data ?? [];
  const total = data?.total ?? rows.length;
  const registers = registerPage?.data ?? [];
  const users = directory?.items ?? [];

  const ownerName = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name]));
    return (uid: string | null) => (uid ? map.get(uid) ?? 'Assigned' : 'Unassigned');
  }, [users]);

  const clearFilters = () => {
    setStatus(undefined);
    setType(undefined);
    setHierarchy(undefined);
    setRegisterId(undefined);
    setOwnerId(undefined);
    setOverdue(false);
    setDueHorizon(undefined);
  };

  /**
   * One list drives both the Filter badge count and the chip row, so the badge
   * can never disagree with what is actually shown as removable. Search sits in
   * the bar itself and sort is not a filter, so neither appears here.
   */
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; value: string; clear: () => void }[] = [];
    if (status)
      chips.push({ key: 'status', label: 'Status', value: CONTROL_STATUS_LABELS[status], clear: () => setStatus(undefined) });
    if (type)
      chips.push({ key: 'type', label: 'Type', value: CONTROL_TYPE_LABELS[type], clear: () => setType(undefined) });
    if (hierarchy)
      chips.push({ key: 'hierarchy', label: 'Hierarchy', value: CONTROL_HIERARCHY_LABELS[hierarchy], clear: () => setHierarchy(undefined) });
    if (registerId)
      chips.push({
        key: 'register',
        label: 'Register',
        value: registers.find((r) => r.id === registerId)?.name ?? 'Selected',
        clear: () => setRegisterId(undefined),
      });
    if (ownerId)
      chips.push({ key: 'owner', label: 'Owner', value: ownerName(ownerId), clear: () => setOwnerId(undefined) });
    if (overdue)
      chips.push({ key: 'overdue', label: 'Due state', value: 'Overdue only', clear: () => setOverdue(false) });
    if (dueHorizon)
      chips.push({
        key: 'horizon',
        label: 'Horizon',
        value: DUE_HORIZONS.find((h) => h.value === dueHorizon)?.label ?? `${dueHorizon} days`,
        clear: () => setDueHorizon(undefined),
      });
    return chips;
  }, [status, type, hierarchy, registerId, ownerId, overdue, dueHorizon, registers, ownerName]);

  const activeFilterCount = activeChips.length;

  /**
   * Cross-page totals from the status breakdown. "Open" is every status that
   * still owes work — the same set the server's overdue sweep treats as open, so
   * the tile and the overdue count cannot describe different populations.
   */
  const openTotal =
    (statusCounts.PLANNED ?? 0) +
    (statusCounts.IN_PROGRESS ?? 0) +
    (statusCounts.IMPLEMENTED ?? 0) +
    (statusCounts.INEFFECTIVE ?? 0);
  const verifiedTotal = statusCounts.VERIFIED ?? 0;
  const statusTotal = CONTROL_STATUSES.reduce((acc, s) => acc + (statusCounts[s] ?? 0), 0);

  const handleExport = () => {
    if (rows.length === 0) {
      message.info('Nothing to export on this page');
      return;
    }
    exportToCSV(
      'risk-controls',
      [
        'Control #',
        'Title',
        'Risk #',
        'Risk',
        'Type',
        'Hierarchy',
        'Status',
        'Owner',
        'Due date',
        'Overdue',
        'Effective',
        'Verified at',
      ],
      rows.map((c) => [
        c.control_number,
        c.title,
        c.risk?.risk_number ?? '',
        c.risk?.title ?? '',
        CONTROL_TYPE_LABELS[c.type],
        c.hierarchy ? CONTROL_HIERARCHY_LABELS[c.hierarchy] : '',
        CONTROL_STATUS_LABELS[c.status],
        ownerName(c.owner_id),
        c.due_date ? new Date(c.due_date).toISOString().slice(0, 10) : '',
        c.is_overdue ? 'Yes' : 'No',
        c.is_effective == null ? '' : c.is_effective ? 'Yes' : 'No',
        c.verified_at ? new Date(c.verified_at).toISOString().slice(0, 10) : '',
      ]),
    );
  };

  const columns = useMemo<Column<RiskControl>[]>(
    () => [
      {
        key: 'control_number',
        header: 'Control #',
        render: (c) => <span className="font-mono text-xs text-blue-700">{c.control_number}</span>,
      },
      {
        key: 'title',
        header: 'Control',
        render: (c) => (
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate max-w-[280px]">{c.title}</p>
            <p className="text-xs text-gray-500 truncate max-w-[280px]">
              {CONTROL_TYPE_LABELS[c.type]}
              {c.hierarchy ? ` · ${CONTROL_HIERARCHY_LABELS[c.hierarchy]}` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'risk',
        header: 'Parent risk',
        render: (c) =>
          c.risk ? (
            <button
              type="button"
              className="text-left min-w-0 group"
              onClick={(e) => {
                e.stopPropagation();
                nav(`/risk/risks/${c.risk_id}`);
              }}
            >
              <span className="inline-flex items-center gap-1 font-mono text-xs text-blue-700 group-hover:underline">
                {c.risk.risk_number}
                <ExternalLink size={11} />
              </span>
              <p className="text-xs text-gray-500 truncate max-w-[220px]">{c.risk.title}</p>
            </button>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
      },
      { key: 'status', header: 'Status', render: (c) => <ControlStatusBadge status={c.status} /> },
      {
        key: 'owner',
        header: 'Owner',
        render: (c) => (
          <span className={c.owner_id ? 'text-xs text-gray-700' : 'text-xs text-gray-400'}>
            {ownerName(c.owner_id)}
          </span>
        ),
      },
      {
        key: 'due_date',
        header: 'Due',
        render: (c) => (
          <span
            className={
              c.is_overdue
                ? 'inline-flex items-center gap-1 text-xs font-semibold text-red-600'
                : 'text-xs text-gray-600'
            }
          >
            {c.is_overdue && <TriangleAlert size={12} />}
            {fmtDate(c.due_date)}
          </span>
        ),
      },
      {
        key: 'effectiveness',
        header: 'Effective',
        render: (c) =>
          c.is_effective == null ? (
            <span className="text-xs text-gray-400">Not verified</span>
          ) : (
            <Badge variant={c.is_effective ? 'success' : 'danger'} dot>
              {c.is_effective ? 'Effective' : 'Ineffective'}
            </Badge>
          ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        className: 'text-right',
        render: (c) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canApprove && c.status !== 'CANCELLED' && (
              <Tooltip title="Verify effectiveness">
                <AntButton
                  type="text"
                  size="small"
                  icon={<BadgeCheck size={15} />}
                  onClick={() => setVerifyTarget(c)}
                />
              </Tooltip>
            )}
            <Tooltip title="Open parent risk">
              <AntButton
                type="text"
                size="small"
                icon={<ExternalLink size={15} />}
                onClick={() => nav(`/risk/risks/${c.risk_id}`)}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canApprove, ownerName],
  );

  return (
    <>
      {/* Toolbar first, KPI strip second — the filters scope what the numbers
          below are counting, so they read in that order. */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search control # or title"
        title="Filter controls"
        activeCount={activeFilterCount}
        onClear={clearFilters}
        actions={
          <AntButton icon={<Download size={14} />} onClick={handleExport}>
            Export CSV
          </AntButton>
        }
      >
        <FilterField label="Status">
          <AntSelect
            allowClear
            placeholder="All statuses"
            style={{ width: '100%' }}
            value={status}
            onChange={(v) => setStatus(v ?? undefined)}
            options={CONTROL_STATUSES.map((s) => ({ value: s, label: CONTROL_STATUS_LABELS[s] }))}
          />
        </FilterField>
        <FilterField label="Type">
          <AntSelect
            allowClear
            placeholder="All types"
            style={{ width: '100%' }}
            value={type}
            onChange={(v) => setType(v ?? undefined)}
            options={CONTROL_TYPES.map((t) => ({ value: t, label: CONTROL_TYPE_LABELS[t] }))}
          />
        </FilterField>
        <FilterField label="Hierarchy">
          <AntSelect
            allowClear
            placeholder="All hierarchies"
            style={{ width: '100%' }}
            value={hierarchy}
            onChange={(v) => setHierarchy(v ?? undefined)}
            options={CONTROL_HIERARCHIES.map((h) => ({ value: h, label: CONTROL_HIERARCHY_LABELS[h] }))}
          />
        </FilterField>
        <FilterField label="Register">
          <AntSelect
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="All registers"
            style={{ width: '100%' }}
            value={registerId}
            onChange={(v) => setRegisterId(v ?? undefined)}
            options={registers.map((r) => ({ value: r.id, label: r.name }))}
          />
        </FilterField>
        <FilterField label="Owner">
          <AntSelect
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="All owners"
            style={{ width: '100%' }}
            value={ownerId}
            onChange={(v) => setOwnerId(v ?? undefined)}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
        </FilterField>
        <FilterField label="Due state">
          <AntButton
            block
            type={overdue ? 'primary' : 'default'}
            danger={overdue}
            icon={<TriangleAlert size={14} />}
            onClick={() => setOverdue((v) => !v)}
          >
            Overdue only
          </AntButton>
        </FilterField>
        <FilterField label="Due horizon">
          <AntSelect
            allowClear
            placeholder="Any due date"
            style={{ width: '100%' }}
            value={dueHorizon}
            onChange={(v) => setDueHorizon(v ?? undefined)}
            options={DUE_HORIZONS.map((h) => ({ value: h.value, label: h.label }))}
          />
        </FilterField>
        <FilterField label="Sort by">
          <div className="flex gap-2">
            <AntSelect
              style={{ flex: 1 }}
              value={sortBy}
              onChange={(v) => {
                setSortBy(v);
                setSortDir(SORTS.find((s) => s.value === v)?.dir ?? 'asc');
              }}
              options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
            />
            <AntSelect
              style={{ width: 118 }}
              value={sortDir}
              onChange={(v) => setSortDir(v)}
              options={[
                { value: 'asc', label: 'Ascending' },
                { value: 'desc', label: 'Descending' },
              ]}
            />
          </div>
        </FilterField>
      </FilterBar>

      {/* Active filters as removable chips. The modal is where filters are set;
          this row is how you see and undo them without reopening it. */}
      {activeChips.length > 0 && (
        <div className="-mt-2 mb-3 flex flex-wrap items-center gap-1.5">
          {activeChips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-1 pl-2.5 pr-1 text-[11px] shadow-sm"
            >
              <span className="font-semibold uppercase tracking-wide text-gray-400">{c.label}</span>
              <span className="max-w-[180px] truncate font-medium text-gray-800">{c.value}</span>
              <button
                type="button"
                onClick={c.clear}
                aria-label={`Remove ${c.label} filter`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-0.5 rounded-full px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            Clear all
          </button>
        </div>
      )}

      {/* A wrapping grid, not a scrolling flex row: tiles share one row on wide
          screens and reflow on narrow ones, rather than stretching to the tallest
          card. Every tile carries a subtitle — mixing subtitled and bare tiles in
          one stretched row is what left the empty band inside the short ones, and
          the line of context is worth more here than the saved pixels. */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={ShieldCheck}
          label="Matching controls"
          value={total}
          accent="slate"
          subtitle={
            activeFilterCount > 0
              ? `${activeFilterCount} filter(s) applied`
              : 'Every control, all registers'
          }
        />
        <KpiCard
          icon={TriangleAlert}
          label="Overdue"
          value={overduePage?.total ?? 0}
          accent={(overduePage?.total ?? 0) > 0 ? 'red' : 'slate'}
          alert={(overduePage?.total ?? 0) > 0}
          selected={overdue}
          onClick={() => setOverdue((v) => !v)}
          subtitle={overdue ? 'Filtering to overdue' : 'Past due, across all registers'}
        />
        <KpiCard
          icon={ListChecks}
          label="Open"
          value={openTotal}
          accent="blue"
          subtitle={`Of ${statusTotal} in scope · still owes work`}
        />
        <KpiCard
          icon={BadgeCheck}
          label="Verified effective"
          value={verifiedTotal}
          accent="emerald"
          // Denominator is the status-mix population, which ignores the status
          // filter — so it must not be called "matching", a word the tile above
          // uses for the fully-filtered count.
          subtitle={
            statusTotal > 0
              ? `${Math.round((verifiedTotal / statusTotal) * 100)}% of ${statusTotal} in scope`
              : 'Nothing in scope'
          }
        />
      </div>

      {/* Status distribution across the whole filtered result — the page's one
          analysis panel, and the fastest way to pick a status without opening the
          filter modal. */}
      {statusTotal > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200/80 bg-white px-4 py-3 shadow-sm">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">
              Status mix
            </h3>
            <span className="text-[11px] text-gray-400">
              {statusTotal} control(s) across all pages
            </span>
          </div>

          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            {CONTROL_STATUSES.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => (
              <button
                key={s}
                type="button"
                title={`${CONTROL_STATUS_LABELS[s]} — ${statusCounts[s]}`}
                onClick={() => setStatus(status === s ? undefined : s)}
                className="h-full transition-opacity first:rounded-l-full last:rounded-r-full hover:opacity-80"
                style={{
                  width: `${((statusCounts[s] ?? 0) / statusTotal) * 100}%`,
                  backgroundColor: STATUS_BAR_COLOR[s],
                  opacity: status && status !== s ? 0.28 : 1,
                }}
              />
            ))}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {CONTROL_STATUSES.map((s) => {
              const n = statusCounts[s] ?? 0;
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={n === 0}
                  onClick={() => setStatus(active ? undefined : s)}
                  className={
                    active
                      ? 'inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-900'
                      : 'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-gray-500 enabled:hover:bg-gray-50 enabled:hover:text-gray-900 disabled:text-gray-300'
                  }
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: n > 0 ? STATUS_BAR_COLOR[s] : '#E2E8F0' }}
                  />
                  {CONTROL_STATUS_LABELS[s]}
                  <span className="font-bold tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}


      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No controls match these filters"
          onRowClick={(c) => nav(`/risk/risks/${c.risk_id}`)}
          rowClassName={(c) => (c.is_overdue ? 'bg-red-50/40' : '')}
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems: total,
            onPageChange: setPage,
          }}
        />
      </div>

      <VerifyControlDrawer control={verifyTarget} onClose={() => setVerifyTarget(null)} />
    </>
  );
}

// ── Verification ────────────────────────────────────────────────────────────

function VerifyControlDrawer({
  control,
  onClose,
}: {
  control: RiskControl | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      title={control ? `Verify ${control.control_number}` : 'Verify control'}
      width={460}
      open={!!control}
      onClose={onClose}
      destroyOnClose
      footer={null}
    >
      {control && <VerifyControlForm control={control} onDone={onClose} />}
    </Drawer>
  );
}

/**
 * Split out so `useVerifyControl` is always bound to a real control id — a hook
 * keyed off `target?.id ?? ''` would happily POST to /risk/controls//verify.
 */
function VerifyControlForm({ control, onDone }: { control: RiskControl; onDone: () => void }) {
  const [form] = Form.useForm<{ isEffective: string; effectiveness: string; verifiedAt?: Dayjs }>();
  const verifyMut = useVerifyControl(control.id);

  const submit = async () => {
    const v = await form.validateFields();
    try {
      await verifyMut.mutateAsync({
        isEffective: v.isEffective === 'yes',
        effectiveness: v.effectiveness.trim(),
        verifiedAt: v.verifiedAt ? v.verifiedAt.toISOString() : null,
      });
      message.success('Verification recorded');
      onDone();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <p className="text-sm font-medium text-gray-900">{control.title}</p>
        {control.risk && (
          <p className="text-xs text-gray-500 mt-0.5 truncate" title={control.risk.title}>
            {control.risk.risk_number} — {control.risk.title}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          {CONTROL_TYPE_LABELS[control.type]}
          {control.hierarchy ? ` · ${CONTROL_HIERARCHY_LABELS[control.hierarchy]}` : ''} · due{' '}
          {fmtDate(control.due_date)}
        </p>
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Recording a control as ineffective invalidates the residual assessment that relied on it.
        Describe what was checked and what it showed.
      </p>
      <Form
        form={form}
        layout="vertical"
        requiredMark
        initialValues={{ isEffective: 'yes', effectiveness: '' }}
      >
        <Form.Item name="isEffective" label="Verdict" rules={[{ required: true }]}>
          <AntSelect
            options={[
              { value: 'yes', label: 'Effective — the control performs as intended' },
              { value: 'no', label: 'Ineffective — the control does not reduce the risk' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="effectiveness"
          label="Effectiveness evidence"
          rules={[{ required: true, message: 'Describe the effectiveness evidence' }]}
        >
          <AntInput.TextArea rows={4} placeholder="What was checked, over what period, and the result" />
        </Form.Item>
        <Form.Item name="verifiedAt" label="Verified on" extra="Defaults to now.">
          <DatePicker className="w-full" />
        </Form.Item>
      </Form>
      <div className="flex justify-end gap-2">
        <AntButton onClick={onDone}>Cancel</AntButton>
        <AntButton type="primary" loading={verifyMut.isPending} onClick={submit}>
          Record verification
        </AntButton>
      </div>
    </>
  );
}
