import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Input, Modal, Select, Spinner, Tabs, Badge } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { useAuthStore } from '@/stores/authStore';
import {
  useActionCriteria,
  useActionTypes,
  useCreateActionCriteria,
  useCreateActionType,
  useCreateStageStatus,
  useCreateWorkflowType,
  useDeleteWorkflowType,
  usePriorities,
  useStageStatuses,
  useWorkflowTypes,
} from '@/lib/api/workflowLookups';
import type { StageActionBehavior } from '@/lib/api/workflow';

const BEHAVIORS: StageActionBehavior[] = ['FORWARD', 'REJECT', 'HOLD', 'UNHOLD', 'RETURN', 'REASSIGN'];

const TABS = [
  { id: 'types', label: 'Workflow Types' },
  { id: 'statuses', label: 'Stage Statuses' },
  { id: 'action-types', label: 'Action Types' },
  { id: 'criteria', label: 'Action Criteria' },
  { id: 'priorities', label: 'Priorities' },
];

type ApiError = { response?: { data?: { error?: { message?: string } } } };
const errorMsg = (err: unknown, fallback: string) =>
  (err as ApiError)?.response?.data?.error?.message ?? fallback;

export default function WorkflowLookupsPage() {
  const [activeTab, setActiveTab] = useState('types');
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('workflow.lookups.manage');

  return (
    <PageContainer>
      <PageHeader
        title="Workflow Lookups"
        description="Manage shared lookup tables used by the workflow builder."
      />
      <div className="mt-6">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <div className="mt-4">
        {activeTab === 'types' && <WorkflowTypesTab canManage={canManage} />}
        {activeTab === 'statuses' && <StageStatusesTab canManage={canManage} />}
        {activeTab === 'action-types' && <ActionTypesTab canManage={canManage} />}
        {activeTab === 'criteria' && <ActionCriteriaTab canManage={canManage} />}
        {activeTab === 'priorities' && <PrioritiesTab />}
      </div>
    </PageContainer>
  );
}

// ── Workflow Types ──────────────────────────────────────────────────────────

function WorkflowTypesTab({ canManage }: { canManage: boolean }) {
  const { data = [], isLoading } = useWorkflowTypes();
  const create = useCreateWorkflowType();
  const remove = useDeleteWorkflowType();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [iconName, setIconName] = useState('');
  const [codePrefix, setCodePrefix] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Name is required');
    try {
      await create.mutateAsync({
        name: name.trim(),
        codePrefix: codePrefix.trim() || undefined,
        iconName: iconName.trim() || undefined,
      });
      toast.success('Type created');
      setOpen(false);
      setName('');
      setIconName('');
      setCodePrefix('');
    } catch (err) {
      toast.error(errorMsg(err, 'Failed to create'));
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Delete "${label}"? Soft-delete by default.`)) return;
    try {
      await remove.mutateAsync({ id });
      toast.success('Type deleted');
    } catch (err) {
      toast.error(errorMsg(err, 'Failed to delete'));
    }
  };

  return (
    <Card>
      <ListHeader
        count={data.length}
        canManage={canManage}
        onAdd={() => setOpen(true)}
        addLabel="New Type"
      />
      {isLoading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">No workflow types yet.</p>
      ) : (
        <table className="w-full text-sm mt-3">
          <thead className="text-xs text-gray-500 text-left">
            <tr className="border-b border-gray-100">
              <th className="py-2">Name</th>
              <th className="py-2">Code prefix</th>
              <th className="py-2">Icon</th>
              <th className="py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((t) => (
              <tr key={t.id} className="border-b border-gray-100">
                <td className="py-2 font-medium text-gray-900">{t.name}</td>
                <td className="py-2 text-gray-700">{t.codePrefix ?? '—'}</td>
                <td className="py-2 text-gray-500">{t.iconConfig?.iconName ?? '—'}</td>
                <td className="py-2 text-right">
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id, t.name)}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="New Workflow Type"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} isLoading={create.isPending}>
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Document Review" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Code prefix (optional)</label>
            <Input
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
              placeholder="DOC"
              maxLength={20}
            />
            <p className="text-xs text-gray-500 mt-1">Used as ticket-id prefix. Auto-derived from name if blank.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Icon name (optional)</label>
            <Input value={iconName} onChange={(e) => setIconName(e.target.value)} placeholder="file-text" />
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ── Stage Statuses ──────────────────────────────────────────────────────────

function StageStatusesTab({ canManage }: { canManage: boolean }) {
  const { data = [], isLoading } = useStageStatuses();
  const create = useCreateStageStatus();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [behavior, setBehavior] = useState<StageActionBehavior>('FORWARD');

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Name is required');
    try {
      await create.mutateAsync({ name: name.trim(), behavior });
      toast.success('Status created');
      setOpen(false);
      setName('');
      setBehavior('FORWARD');
    } catch (err) {
      toast.error(errorMsg(err, 'Failed to create'));
    }
  };

  return (
    <Card>
      <ListHeader
        count={data.length}
        canManage={canManage}
        onAdd={() => setOpen(true)}
        addLabel="New Status"
      />
      {isLoading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">No stage statuses yet.</p>
      ) : (
        <table className="w-full text-sm mt-3">
          <thead className="text-xs text-gray-500 text-left">
            <tr className="border-b border-gray-100">
              <th className="py-2">Name</th>
              <th className="py-2">Behavior</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-2 font-medium text-gray-900">{s.name}</td>
                <td className="py-2">
                  <Badge variant="info">{s.behavior}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="New Stage Status"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} isLoading={create.isPending}>
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Approve" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Behavior</label>
            <Select
              value={behavior}
              onChange={(e) => setBehavior(e.target.value as StageActionBehavior)}
              options={BEHAVIORS.map((b) => ({ value: b, label: b }))}
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ── Action Types ────────────────────────────────────────────────────────────

function ActionTypesTab({ canManage }: { canManage: boolean }) {
  const { data = [], isLoading } = useActionTypes();
  const create = useCreateActionType();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Name is required');
    try {
      await create.mutateAsync({ name: name.trim() });
      toast.success('Action type created');
      setOpen(false);
      setName('');
    } catch (err) {
      toast.error(errorMsg(err, 'Failed to create'));
    }
  };

  return (
    <Card>
      <ListHeader
        count={data.length}
        canManage={canManage}
        onAdd={() => setOpen(true)}
        addLabel="New Type"
      />
      <SimpleList items={data.map((t) => ({ id: t.id, label: t.name }))} loading={isLoading} />
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="New Action Type"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} isLoading={create.isPending}>
              Create
            </Button>
          </div>
        }
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      </Modal>
    </Card>
  );
}

// ── Action Criteria ─────────────────────────────────────────────────────────

function ActionCriteriaTab({ canManage }: { canManage: boolean }) {
  const { data = [], isLoading } = useActionCriteria();
  const create = useCreateActionCriteria();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Name is required');
    try {
      await create.mutateAsync({ name: name.trim() });
      toast.success('Criteria created');
      setOpen(false);
      setName('');
    } catch (err) {
      toast.error(errorMsg(err, 'Failed to create'));
    }
  };

  return (
    <Card>
      <ListHeader
        count={data.length}
        canManage={canManage}
        onAdd={() => setOpen(true)}
        addLabel="New Criteria"
      />
      <SimpleList items={data.map((c) => ({ id: c.id, label: c.name }))} loading={isLoading} />
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="New Action Criteria"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} isLoading={create.isPending}>
              Create
            </Button>
          </div>
        }
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      </Modal>
    </Card>
  );
}

// ── Priorities (read-only) ──────────────────────────────────────────────────

function PrioritiesTab() {
  const { data = [], isLoading } = usePriorities();
  return (
    <Card>
      <p className="text-xs text-gray-500 mb-3">
        Priorities are seeded and not editable through the admin UI.
      </p>
      <SimpleList items={data.map((p) => ({ id: p.id, label: p.name }))} loading={isLoading} />
    </Card>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function ListHeader({
  count,
  canManage,
  onAdd,
  addLabel,
}: {
  count: number;
  canManage: boolean;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-gray-500">
        {count} row{count === 1 ? '' : 's'}
      </p>
      {canManage && (
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus size={14} />
          <span className="ml-1">{addLabel}</span>
        </Button>
      )}
    </div>
  );
}

function SimpleList({
  items,
  loading,
}: {
  items: { id: string; label: string }[];
  loading: boolean;
}) {
  if (loading) return <Spinner />;
  if (items.length === 0) {
    return <p className="text-xs text-gray-500 py-6 text-center">No rows.</p>;
  }
  return (
    <ul className="space-y-1 mt-3">
      {items.map((it) => (
        <li
          key={it.id}
          className="px-3 py-2 rounded border border-gray-100 text-sm text-gray-900"
        >
          {it.label}
        </li>
      ))}
    </ul>
  );
}
