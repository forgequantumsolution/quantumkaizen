import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Network,
  Workflow as WorkflowIcon,
  Clock,
  Trash2,
  Edit3,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, Button, EmptyState, Spinner, Input, Select } from '@/components/ui';
import { cn, formatDate, displayWorkflowName } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import {
  useWorkflows,
  useSetWorkflowStatus,
  useSoftDeleteWorkflow,
  workflowKeys,
  type WorkflowSummary,
  type WorkflowLifecycleStatus,
} from '@/lib/api/workflow';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import CreateWorkflowModal from './shared/CreateWorkflowModal';
import WorkflowStatusBadge from './shared/WorkflowStatusBadge';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const PAGE_SIZE = 12;

interface Props {
  // Provided by an outer wrapper (SettingsPage) that owns the create flow.
  // When set, this page skips its own header button + modal and delegates
  // create triggers (e.g. from EmptyState) to the parent.
  onCreateWorkflow?: () => void;
}

export default function WorkflowsPage({ onCreateWorkflow }: Props = {}) {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('workflow.create');
  const canUpdate = hasPermission('workflow.update');
  const canDelete = hasPermission('workflow.delete');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowLifecycleStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Any filter change resets to the first page so results aren't hidden behind
  // a now-out-of-range page number.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter]);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      typeId: typeFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, statusFilter, typeFilter, page],
  );

  const { data, isLoading, error } = useWorkflows(filters);
  const { data: types = [] } = useWorkflowTypes();
  const softDelete = useSoftDeleteWorkflow();
  const confirmDelete = useConfirmDelete();

  const handleDelete = (wf: WorkflowSummary) => {
    confirmDelete({
      entityLabel: 'workflow',
      name: wf.name,
      extraWarning: 'This is a soft-delete and can be undone by an admin.',
      mutate: () => softDelete.mutateAsync(wf.id),
      invalidateKey: workflowKeys.all,
      successMessage: 'Workflow deleted',
    });
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // When embedded (SettingsPage passes onCreateWorkflow), the parent owns the
  // create flow — we don't render our own header button or modal here.
  const isEmbedded = onCreateWorkflow !== undefined;
  const triggerCreate = onCreateWorkflow ?? (() => setCreateOpen(true));

  return (
    <>
      {/* ── Hero header + filters ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden border-l-[3px] border-l-gold-500">
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <WorkflowIcon size={18} />
              </span>
              <div className="min-w-0">
                <h1 className="text-[15px] font-bold text-gray-900 tracking-tight truncate leading-none">
                  Workflows
                </h1>
                <p className="text-[11px] text-gray-400 truncate leading-tight mt-1">
                  Browse and configure workflow definitions.
                </p>
              </div>
            </div>
            {canCreate && (
              <Button variant="primary" size="sm" onClick={triggerCreate}>
                <Plus size={14} />
                <span className="ml-1.5">Create Workflow</span>
              </Button>
            )}
          </div>

          <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
              />
              <Input
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 !rounded-full"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as WorkflowLifecycleStatus | '')}
              options={STATUS_OPTIONS}
            />
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: '', label: 'All types' },
                ...types.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <Card>
            <p className="text-sm text-red-600">Failed to load workflows.</p>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon={WorkflowIcon}
              title="No workflows yet"
              description={
                search || statusFilter || typeFilter
                  ? 'No workflows match the current filters. Try clearing them.'
                  : canCreate
                    ? 'Create your first workflow to get started.'
                    : "You don't have any workflows yet."
              }
              actionLabel={canCreate ? 'Create Workflow' : undefined}
              onAction={canCreate ? triggerCreate : undefined}
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((wf) => (
                <WorkflowCard
                  key={wf.id}
                  workflow={wf}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onOpen={() => navigate(`/workflows/${wf.id}`)}
                  onEdit={() => navigate(`/workflows/${wf.id}/builder`)}
                  onDelete={() => handleDelete(wf)}
                />
              ))}
            </div>

            {total > PAGE_SIZE && (
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                rangeStart={(page - 1) * PAGE_SIZE + 1}
                rangeEnd={Math.min(page * PAGE_SIZE, total)}
                onChange={setPage}
              />
            )}
          </>
        )}
      </div>

      {!isEmbedded && (
        <CreateWorkflowModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      )}
    </>
  );
}

// Status-driven accents for the card's top bar + icon badge.
const STATUS_ACCENT: Record<
  WorkflowLifecycleStatus,
  { bar: string; iconBg: string; iconColor: string; ring: string }
> = {
  ACTIVE: { bar: '#22C55E', iconBg: '#F0FDF4', iconColor: '#16A34A', ring: '#BBF7D0' },
  DRAFT: { bar: '#F59E0B', iconBg: '#FFFBEB', iconColor: '#D97706', ring: '#FDE68A' },
  DRAFT_UPDATE: { bar: '#F59E0B', iconBg: '#FFFBEB', iconColor: '#D97706', ring: '#FDE68A' },
  INACTIVE: { bar: '#94A3B8', iconBg: '#F8FAFC', iconColor: '#64748B', ring: '#E2E8F0' },
};

function WorkflowCard({
  workflow,
  canUpdate,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
}: {
  workflow: WorkflowSummary;
  canUpdate: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Each card holds its own status-flip mutation. Hooks in a loop are fine
  // here because each `WorkflowCard` instance is a separate React component.
  const setStatus = useSetWorkflowStatus(workflow.id);
  const handleSetStatus = async (next: 'ACTIVE' | 'INACTIVE') => {
    try {
      await setStatus.mutateAsync(next);
      toast.success(
        next === 'ACTIVE' ? 'Workflow activated' : 'Workflow deactivated',
      );
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to change status';
      toast.error(msg);
    }
  };

  const accent = STATUS_ACCENT[workflow.workflowStatus] ?? STATUS_ACCENT.INACTIVE;

  return (
    <div
      onClick={onOpen}
      className="group relative flex flex-col rounded-2xl border border-gray-200/80 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      <div className="p-4 flex flex-col gap-3.5 flex-1">
        {/* Row 1 — status + version */}
        <div className="flex items-center justify-between gap-2">
          <WorkflowStatusBadge status={workflow.workflowStatus} />
          <span
            className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md tabular-nums"
            title={`Workflow version ${workflow.version}`}
          >
            v{workflow.version}
          </span>
        </div>

        {/* Row 2 — identity */}
        <div className="flex items-start gap-3">
          <span
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: accent.iconBg, color: accent.iconColor, boxShadow: `0 0 0 1px ${accent.ring}` }}
          >
            <WorkflowIcon size={19} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-[15px] font-semibold text-gray-900 truncate leading-tight group-hover:text-gold-700 transition-colors">
              {displayWorkflowName(workflow)}
            </h3>
            <span
              className={cn(
                'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium mt-1.5',
                workflow.type?.name
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-gray-50 text-gray-400 italic',
              )}
            >
              {workflow.type?.name ?? 'No type'}
            </span>
          </div>
        </div>

        {/* Row 3 — meta */}
        <div className="mt-auto flex items-center gap-2 text-xs text-gray-500 pt-1">
          <span className="inline-flex items-center gap-1.5">
            <Network size={13} className="text-gray-400" />
            {workflow.stageCount} {workflow.stageCount === 1 ? 'stage' : 'stages'}
          </span>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} className="text-gray-400" />
            {formatDate(workflow.updatedAt)}
          </span>
          {workflow.createdBy && (
            <span className="ml-auto truncate text-[11px] text-gray-400" title={`Created by ${workflow.createdBy.name}`}>
              {workflow.createdBy.name}
            </span>
          )}
        </div>
      </div>

      {/* Footer — actions */}
      <div className="flex items-center gap-0.5 px-2.5 py-2 border-t border-gray-100 bg-gray-50/60">
        {canUpdate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit3 size={14} />
            <span className="ml-1">Edit</span>
          </Button>
        )}
        {canUpdate &&
          (workflow.workflowStatus === 'ACTIVE' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleSetStatus('INACTIVE');
              }}
              isLoading={setStatus.isPending}
              disabled={setStatus.isPending}
            >
              <Pause size={14} className="text-amber-600" />
              <span className="ml-1">Deactivate</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleSetStatus('ACTIVE');
              }}
              isLoading={setStatus.isPending}
              disabled={setStatus.isPending || workflow.stageCount === 0}
              title={
                workflow.stageCount === 0
                  ? 'Open the builder and add at least one stage before activating'
                  : 'Flip status to ACTIVE'
              }
            >
              <Play size={14} className="text-green-600" />
              <span className="ml-1">Activate</span>
            </Button>
          ))}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete workflow"
          >
            <Trash2 size={14} className="text-red-500" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onChange: (p: number) => void;
}) {
  // Show a sliding window of up to 5 page buttons centred on the current page.
  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => windowStart + i);

  return (
    <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-gray-500">
        Showing <span className="font-medium text-gray-700">{rangeStart}</span>–
        <span className="font-medium text-gray-700">{rangeEnd}</span> of{' '}
        <span className="font-medium text-gray-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              'min-w-8 h-8 px-2 inline-flex items-center justify-center text-xs font-semibold rounded-lg border transition-colors',
              p === page
                ? 'bg-gold-500 text-white border-gold-500'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100',
            )}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
