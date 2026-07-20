import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { App, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Plus,
  Search,
  Ticket as TicketIcon,
  AlertTriangle,
  TimerReset,
  Circle,
  CheckCircle2,
  XCircle,
  Filter as FilterIcon,
  X,
  Network,
  Trash2,
} from 'lucide-react';
import {
  Card,
  Button,
  EmptyState,
  Spinner,
  Input,
  Select,
  KpiCard,
} from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import { cn, formatDate, displayWorkflowName } from '@/lib/utils';
import { useHasAnyPermissionMatching } from '@/stores/authStore';
import {
  useDeleteTicket,
  useTickets,
  ticketOutcome,
  isCompletedSuccessfully,
  type ListTicketsQuery,
  type TicketSummary,
} from '@/lib/api/ticket';
import { useWorkflowDirectory } from '@/lib/api/workflow';
import { usePriorities } from '@/lib/api/workflowLookups';
import { useSlaTimers, type SlaTimer } from '@/lib/api/sla';
import RaiseTicketDrawer from './shared/RaiseTicketDrawer';
import TicketStatusBadge from './shared/TicketStatusBadge';

type StatusFilter = NonNullable<ListTicketsQuery['status']>;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
];

const computeElapsedSec = (timer: SlaTimer, now = Date.now()) => {
  if (timer.status === 'PAUSED' || !timer.lastResumedAt) {
    return timer.elapsedBeforePauseSec;
  }
  const running = Math.max(
    0,
    Math.floor((now - new Date(timer.lastResumedAt).getTime()) / 1000),
  );
  return timer.elapsedBeforePauseSec + running;
};

const isAtRisk = (timer: SlaTimer) => {
  if (timer.status !== 'RUNNING' && timer.status !== 'EXTENDED') return false;
  const total = timer.policy.duration;
  if (total <= 0) return false;
  return computeElapsedSec(timer) / total >= 0.8;
};

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function TicketsPage() {
  const navigate = useNavigate();
  // No more global `ticket.create`/`ticket.delete` master — show the button if
  // the user holds create/delete for AT LEAST ONE workflow type; the actual
  // create/delete is still enforced per-type at the API regardless.
  const canCreate = useHasAnyPermissionMatching((k) => /^wf_type\.[^.]+\.create$/.test(k));
  const canDelete = useHasAnyPermissionMatching((k) => /^wf_type\.[^.]+\.delete$/.test(k));
  const deleteTicket = useDeleteTicket();
  const { modal } = App.useApp();

  const handleDelete = (t: TicketSummary) => {
    modal.confirm({
      title: 'Delete ticket',
      content: `Are you sure you want to delete ${t.uniqueId}?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          await deleteTicket.mutateAsync(t.id);
          toast.success('Ticket deleted');
        } catch (err) {
          const msg =
            (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
              ?.error?.message ?? 'Failed to delete';
          toast.error(msg);
        }
      },
    });
  };

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 250);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [mine, setMine] = useState<'true' | 'false'>('false');
  const [priorityId, setPriorityId] = useState<string>('');
  const [workflowFilterId, setWorkflowFilterId] = useState<string>('');
  const [pageSize, setPageSize] = useState(50);
  const [createOpen, setCreateOpen] = useState(false);

  const filters: ListTicketsQuery = useMemo(
    () => ({
      search: search || undefined,
      status,
      mine,
      workflowId: workflowFilterId || undefined,
      pageSize,
    }),
    [search, status, mine, workflowFilterId, pageSize],
  );

  const { data, isLoading, error } = useTickets(filters);
  const { data: priorities = [] } = usePriorities();
  const { data: activeWorkflowsData } = useWorkflowDirectory();
  const breached = useSlaTimers({ status: 'BREACHED', pageSize: 1 });
  const running = useSlaTimers({ status: 'RUNNING', pageSize: 100 });

  // Client-side priority filter — the API doesn't support it directly today.
  const items: TicketSummary[] = useMemo(() => {
    const list = data?.items ?? [];
    if (!priorityId) return list;
    return list.filter((t) => t.priority?.id === priorityId);
  }, [data?.items, priorityId]);
  const totalAll = data?.total ?? 0;

  const breachedCount = breached.data?.total ?? 0;
  const atRiskCount = useMemo(
    () => (running.data?.items ?? []).filter(isAtRisk).length,
    [running.data],
  );

  const openCount = useMemo(
    () => (data?.items ?? []).filter((t) => ticketOutcome(t) === 'open').length,
    [data?.items],
  );
  // Successful finishes only — a rejected flow is also `isCompleted`, and
  // counting rejections as completions overstates this tile.
  const completedCount = useMemo(
    () => (data?.items ?? []).filter(isCompletedSuccessfully).length,
    [data?.items],
  );
  const rejectedCount = useMemo(
    () => (data?.items ?? []).filter((t) => ticketOutcome(t) === 'rejected').length,
    [data?.items],
  );

  const hasActiveFilters =
    !!search || status !== 'all' || mine === 'true' || !!priorityId || !!workflowFilterId;

  const clearFilters = () => {
    setSearchInput('');
    setStatus('all');
    setMine('false');
    setPriorityId('');
    setWorkflowFilterId('');
  };

  return (
    <PageContainer>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-h1 text-gray-900">Tickets</h1>
            <span className="text-xs font-medium text-[#8A6C18] bg-[#C9A84C]/15 px-2 py-0.5 rounded-full">
              {totalAll} in scope
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Raise and track tickets against active workflows.
          </p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            <span className="ml-1.5">Raise Ticket</span>
          </Button>
        )}
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Total tickets"
          value={totalAll}
          icon={TicketIcon}
          accent="slate"
        />
        <KpiCard
          label="Open"
          value={openCount}
          icon={Circle}
          accent="sky"
        />
        <KpiCard
          label="Completed"
          value={completedCount}
          icon={CheckCircle2}
          accent="emerald"
        />
        <KpiCard
          label="Rejected"
          value={rejectedCount}
          icon={XCircle}
          accent="rose"
        />
        <KpiCard
          label={breachedCount > 0 ? 'Breached SLA' : 'At risk'}
          value={breachedCount > 0 ? breachedCount : atRiskCount}
          icon={breachedCount > 0 ? AlertTriangle : TimerReset}
          accent={breachedCount > 0 ? 'rose' : 'amber'}
        />
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <Card className="!p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status segmented tabs */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setStatus(t.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    status === t.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Scope */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(
                [
                  { v: 'false' as const, label: 'All' },
                  { v: 'true' as const, label: 'Mine' },
                ]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setMine(opt.v)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    mine === opt.v
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="relative md:col-span-6">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
              />
              <Input
                placeholder="Search by ID or title…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={priorityId}
              onChange={(e) => setPriorityId(e.target.value)}
              placeholder="Any priority"
              options={[
                { value: '', label: 'Any priority' },
                ...priorities.map((p) => ({ value: p.id, label: p.name })),
              ]}
              className="md:col-span-3"
            />
            <Select
              value={workflowFilterId}
              onChange={(e) => setWorkflowFilterId(e.target.value)}
              placeholder="Any workflow"
              options={[
                { value: '', label: 'Any workflow' },
                ...(activeWorkflowsData?.items ?? []).map((w) => ({
                  value: w.id,
                  label: displayWorkflowName(w),
                })),
              ]}
              className="md:col-span-3"
            />
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FilterIcon size={12} />
              <span>Filters active</span>
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
              >
                <X size={12} /> Clear all
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      <div>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <Card>
            <p className="text-sm text-red-600">Failed to load tickets.</p>
          </Card>
        ) : items.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={TicketIcon}
              title="No tickets match"
              description={
                hasActiveFilters
                  ? 'Try clearing filters or broadening your search.'
                  : canCreate
                    ? 'Raise your first ticket to get started.'
                    : "You don't have any tickets yet."
              }
              actionLabel={
                hasActiveFilters ? 'Clear filters' : canCreate ? 'Raise Ticket' : undefined
              }
              onAction={
                hasActiveFilters
                  ? clearFilters
                  : canCreate
                    ? () => setCreateOpen(true)
                    : undefined
              }
            />
          </Card>
        ) : (
          <Card noPadding className="overflow-hidden">
            <Table<TicketSummary>
              rowKey="id"
              dataSource={items}
              columns={buildColumns({
                canDelete,
                onDelete: handleDelete,
              })}
              pagination={false}
              size="middle"
              onRow={(t) => ({
                onClick: () => navigate(`/tickets/${t.id}`),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        )}

        {!isLoading && totalAll > items.length && !priorityId && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {items.length} of {totalAll}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPageSize((s) => s + 50)}>
              Load 50 more
            </Button>
          </div>
        )}
      </div>

      <RaiseTicketDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </PageContainer>
  );
}

// ─── Table columns ──────────────────────────────────────────────────────────
function buildColumns({
  canDelete,
  onDelete,
}: {
  canDelete: boolean;
  onDelete: (t: TicketSummary) => void;
}): ColumnsType<TicketSummary> {
  const cols: ColumnsType<TicketSummary> = [
    {
      title: 'ID',
      dataIndex: 'uniqueId',
      key: 'uniqueId',
      width: 130,
      render: (uniqueId: string) => (
        <span className="text-[11px] font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
          {uniqueId}
        </span>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string) => (
        <span className="text-sm font-semibold text-gray-900">{title}</span>
      ),
    },
    {
      title: 'Workflow · Stage',
      key: 'workflow',
      width: 220,
      ellipsis: true,
      render: (_, t) => {
        const flow = t.flows[0];
        if (!flow) return <span className="text-gray-400">—</span>;
        return (
          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
            <Network size={11} className="text-gray-400 shrink-0" />
            <span className="truncate">
              {displayWorkflowName({
                id: flow.workflowId,
                name: flow.workflowName,
                version: flow.workflowVersion,
              })}
            </span>
            {flow.currentStages[0] && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-blue-700 truncate">
                  {flow.currentStages[0].name}
                </span>
              </>
            )}
          </span>
        );
      },
    },
    {
      title: 'Priority',
      key: 'priority',
      width: 110,
      render: (_, t) => (
        <span className="text-xs text-gray-700">{t.priority?.name ?? '—'}</span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_, t) => <TicketStatusBadge ticket={t} />,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (updatedAt: string) => (
        <span className="text-xs text-gray-500">{formatDate(updatedAt)}</span>
      ),
    },
  ];

  if (canDelete) {
    cols.push({
      title: '',
      key: 'actions',
      width: 50,
      align: 'center',
      render: (_, t) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(t);
          }}
          className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded"
          title="Delete ticket"
        >
          <Trash2 size={14} />
        </button>
      ),
    });
  }

  return cols;
}
