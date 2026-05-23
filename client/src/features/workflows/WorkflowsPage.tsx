import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, Button, EmptyState, Spinner, Input, Select } from '@/components/ui';
import { cn, formatDate, displayWorkflowName } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import {
  useWorkflows,
  useSetWorkflowStatus,
  useSoftDeleteWorkflow,
  type WorkflowSummary,
  type WorkflowLifecycleStatus,
} from '@/lib/api/workflow';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';
import CreateWorkflowModal from './shared/CreateWorkflowModal';
import WorkflowStatusBadge from './shared/WorkflowStatusBadge';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'INACTIVE', label: 'Inactive' },
];

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

  const filters = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter || undefined,
      typeId: typeFilter || undefined,
      pageSize: 50,
    }),
    [search, statusFilter, typeFilter],
  );

  const { data, isLoading, error } = useWorkflows(filters);
  const { data: types = [] } = useWorkflowTypes();
  const softDelete = useSoftDeleteWorkflow();

  const handleDelete = async (wf: WorkflowSummary) => {
    if (!confirm(`Delete "${wf.name}"? This is a soft-delete and can be undone by an admin.`))
      return;
    try {
      await softDelete.mutateAsync(wf.id);
      toast.success('Workflow deleted');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to delete';
      toast.error(msg);
    }
  };

  const items = data?.items ?? [];

  // When embedded (SettingsPage passes onCreateWorkflow), the parent owns the
  // create flow — we don't render our own header button or modal here.
  const isEmbedded = onCreateWorkflow !== undefined;
  const triggerCreate = onCreateWorkflow ?? (() => setCreateOpen(true));

  return (
    <>
      {!isEmbedded && canCreate && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" onClick={triggerCreate}>
            <Plus size={16} />
            <span className="ml-1.5">Create Workflow</span>
          </Button>
        </div>
      )}

      {/* Filters */}
      <Card className="!p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
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
      </Card>

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
        )}
      </div>

      {!isEmbedded && (
        <CreateWorkflowModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      )}
    </>
  );
}

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

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-3',
        '!p-5',
      )}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-body-md font-semibold text-gray-900 truncate">{displayWorkflowName(workflow)}</h3>
          {workflow.type && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{workflow.type.name}</p>
          )}
        </div>
        <WorkflowStatusBadge status={workflow.workflowStatus} />
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Network size={12} />
          {workflow.stageCount} {workflow.stageCount === 1 ? 'stage' : 'stages'}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {formatDate(workflow.updatedAt)}
        </span>
      </div>

      {workflow.createdBy && (
        <p className="text-xs text-gray-400 truncate">by {workflow.createdBy.name}</p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
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
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} className="text-red-500" />
          </Button>
        )}
      </div>
    </Card>
  );
}
