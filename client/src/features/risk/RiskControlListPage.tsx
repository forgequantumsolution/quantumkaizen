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
import { BadgeCheck, Download, ExternalLink, ListChecks, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Badge, DataTable, KpiCard, type Column } from '@/components/ui';
import { exportToCSV } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useHasPermission } from '@/stores/authStore';
import { useUserDirectory } from '@/features/admin/users/hooks';
import {
  useRiskControls,
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

const SORTS = [
  { value: 'dueDate', label: 'Due date' },
  { value: 'createdAt', label: 'Newest first' },
  { value: 'status', label: 'Status' },
  { value: 'controlNumber', label: 'Control number' },
] as const;

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
  const [sortBy, setSortBy] = useState<(typeof SORTS)[number]['value']>('dueDate');
  const [page, setPage] = useState(1);
  const [verifyTarget, setVerifyTarget] = useState<RiskControl | null>(null);

  const debouncedSearch = useDebouncedValue(search, 400);
  useEffect(
    () => setPage(1),
    [debouncedSearch, status, type, hierarchy, registerId, ownerId, overdue, sortBy],
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
    sortBy,
    sortDir: sortBy === 'createdAt' ? 'desc' : 'asc',
  });

  // A second, count-only query gives an honest overdue KPI even while the main
  // table is filtered to something else.
  const { data: overduePage } = useRiskControls({ overdue: true, page: 1, pageSize: 1 });
  const { data: registerPage } = useRiskRegisters({ isActive: true, page: 1, pageSize: 200 });
  const { data: directory } = useUserDirectory();

  const rows = data?.data ?? [];
  const total = data?.total ?? rows.length;
  const registers = registerPage?.data ?? [];
  const users = directory?.items ?? [];

  // Search sits in the bar itself and sort is not a filter, so neither counts.
  const activeFilterCount =
    (status ? 1 : 0) +
    (type ? 1 : 0) +
    (hierarchy ? 1 : 0) +
    (registerId ? 1 : 0) +
    (ownerId ? 1 : 0) +
    (overdue ? 1 : 0);
  const ownerName = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name]));
    return (uid: string | null) => (uid ? map.get(uid) ?? 'Assigned' : 'Unassigned');
  }, [users]);

  const openOnPage = rows.filter((c) => c.status === 'PLANNED' || c.status === 'IN_PROGRESS').length;
  const verifiedOnPage = rows.filter((c) => c.status === 'VERIFIED').length;

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
        onClear={() => {
          setStatus(undefined);
          setType(undefined);
          setHierarchy(undefined);
          setRegisterId(undefined);
          setOwnerId(undefined);
          setOverdue(false);
        }}
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
        <FilterField label="Sort by">
          <AntSelect
            style={{ width: '100%' }}
            value={sortBy}
            onChange={(v) => setSortBy(v)}
            options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
          />
        </FilterField>
      </FilterBar>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={ShieldCheck}
          label="Matching controls"
          value={total}
          accent="slate"
        />
        <KpiCard
          icon={TriangleAlert}
          label="Overdue"
          value={overduePage?.total ?? 0}
          subtitle="Across all registers"
          accent={(overduePage?.total ?? 0) > 0 ? 'red' : 'slate'}
          onClick={() => setOverdue(true)}
        />
        <KpiCard
          icon={ListChecks}
          label="Open on this page"
          value={openOnPage}
          subtitle="Planned or in progress"
          accent="blue"
        />
        <KpiCard
          icon={BadgeCheck}
          label="Verified on this page"
          value={verifiedOnPage}
          accent="emerald"
        />
      </div>


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
