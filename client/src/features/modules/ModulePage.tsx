import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { App, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Plus,
  Search,
  Ticket as TicketIcon,
  Filter as FilterIcon,
  X,
  Network,
  Trash2,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { Card, Button, EmptyState, Spinner, Input, Select } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import { cn, formatDate, displayWorkflowName } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import {
  useDeleteTicket,
  useTickets,
  type ListTicketsQuery,
  type TicketSummary,
} from '@/lib/api/ticket';
import { useWorkflows } from '@/lib/api/workflow';
import {
  usePriorities,
  useWorkflowTypes,
} from '@/lib/api/workflowLookups';
import RaiseTicketDrawer from '@/features/tickets/shared/RaiseTicketDrawer';
import TicketStatusBadge from '@/features/tickets/shared/TicketStatusBadge';

type StatusFilter = NonNullable<ListTicketsQuery['status']>;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
];

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ModulePage() {
  const { typeId = '' } = useParams<{ typeId: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('ticket.create');
  const canDelete = hasPermission('ticket.delete');
  const deleteTicket = useDeleteTicket();
  const { modal } = App.useApp();

  const { data: types = [], isLoading: loadingTypes } = useWorkflowTypes();
  const workflowType = useMemo(
    () => types.find((t) => t.id === typeId),
    [types, typeId],
  );

  // Reset filters when navigating between modules.
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 250);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [mine, setMine] = useState<'true' | 'false'>('false');
  const [priorityId, setPriorityId] = useState<string>('');
  const [workflowFilterId, setWorkflowFilterId] = useState<string>('');
  const [pageSize, setPageSize] = useState(50);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setSearchInput('');
    setStatus('all');
    setMine('false');
    setPriorityId('');
    setWorkflowFilterId('');
  }, [typeId]);

  const filters: ListTicketsQuery = useMemo(
    () => ({
      search: search || undefined,
      status,
      mine,
      workflowTypeId: typeId || undefined,
      workflowId: workflowFilterId || undefined,
      pageSize,
    }),
    [search, status, mine, typeId, workflowFilterId, pageSize],
  );

  const { data, isLoading, error } = useTickets(filters);
  const { data: priorities = [] } = usePriorities();
  const { data: workflowsData } = useWorkflows({
    status: 'ACTIVE',
    typeId: typeId || undefined,
    pageSize: 100,
  });
  const typeWorkflows = workflowsData?.items ?? [];

  const items: TicketSummary[] = useMemo(() => {
    const list = data?.items ?? [];
    if (!priorityId) return list;
    return list.filter((t) => t.priority?.id === priorityId);
  }, [data?.items, priorityId]);
  const totalAll = data?.total ?? 0;

  const hasActiveFilters =
    !!search || status !== 'all' || mine === 'true' || !!priorityId || !!workflowFilterId;

  const clearFilters = () => {
    setSearchInput('');
    setStatus('all');
    setMine('false');
    setPriorityId('');
    setWorkflowFilterId('');
  };

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

  if (!loadingTypes && !workflowType) {
    return (
      <PageContainer>
        <Card className="border-dashed">
          <EmptyState
            icon={WorkflowIcon}
            title="Module not found"
            description="This workflow type doesn't exist or has been removed."
            actionLabel="Back to Tickets"
            onAction={() => navigate('/tickets')}
          />
        </Card>
      </PageContainer>
    );
  }

  const moduleName = workflowType?.name ?? 'Module';
  const codePrefix = workflowType?.codePrefix;

  return (
    <PageContainer>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-h1 text-gray-900">{moduleName}</h1>
            {codePrefix && (
              <span className="text-[11px] font-mono font-semibold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                {codePrefix}
              </span>
            )}
            <span className="text-xs font-medium text-[#8A6C18] bg-[#C9A84C]/15 px-2 py-0.5 rounded-full">
              {totalAll} in scope
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Tickets raised against the <span className="font-medium">{moduleName}</span>{' '}
            workflow type.
          </p>
        </div>
        {canCreate && (
          <Button
            variant="primary"
            onClick={() => setCreateOpen(true)}
            disabled={typeWorkflows.length === 0}
            title={
              typeWorkflows.length === 0
                ? `No active ${moduleName} workflows yet — create one first.`
                : undefined
            }
          >
            <Plus size={16} />
            <span className="ml-1.5">Raise {moduleName}</span>
          </Button>
        )}
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <Card className="!p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
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
                ...typeWorkflows.map((w) => ({ value: w.id, label: displayWorkflowName(w) })),
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
              title={`No ${moduleName} tickets yet`}
              description={
                hasActiveFilters
                  ? 'Try clearing filters or broadening your search.'
                  : typeWorkflows.length === 0
                    ? `No active workflows exist for ${moduleName}. Create one in Workflows first.`
                    : canCreate
                      ? `Raise the first ${moduleName} ticket to get started.`
                      : "You don't have any tickets yet."
              }
              actionLabel={
                hasActiveFilters
                  ? 'Clear filters'
                  : typeWorkflows.length === 0
                    ? 'Go to Workflows'
                    : canCreate
                      ? `Raise ${moduleName}`
                      : undefined
              }
              onAction={
                hasActiveFilters
                  ? clearFilters
                  : typeWorkflows.length === 0
                    ? () => navigate('/workflows')
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
              columns={buildColumns({ canDelete, onDelete: handleDelete })}
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

      <RaiseTicketDrawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        workflowTypeId={typeId}
      />
    </PageContainer>
  );
}

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
                <span className="text-blue-700 truncate">{flow.currentStages[0].name}</span>
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
