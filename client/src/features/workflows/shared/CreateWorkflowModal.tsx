import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { Button, Input, Select, Modal } from '@/components/ui';
import { useCreateWorkflow } from '@/lib/api/workflow';
import { useCreateWorkflowType, useWorkflowTypes } from '@/lib/api/workflowLookups';
import { useAuthStore, useHasPermission } from '@/stores/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateWorkflowModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState('');
  const [siteId, setSiteId] = useState(''); // '' = Global (all sites)
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const { data: types = [], isLoading: typesLoading } = useWorkflowTypes();
  const create = useCreateWorkflow();

  // Only Super Admin (site.view_all) chooses the owning site; scoped users' new
  // workflows are forced to their own site server-side (workflow-site-ownership).
  const canPickSite = useHasPermission('site.view_all');
  const allowedSites = useAuthStore((s) => s.user?.allowedSites ?? []);

  const reset = () => {
    setName('');
    setTypeId('');
    setSiteId('');
    setNewTypeOpen(false);
  };

  const handleClose = () => {
    if (create.isPending) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    if (!typeId) return toast.error('Type is required');
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        typeId,
        // Only send siteId when the user may choose it; '' = Global (null).
        // Scoped creators omit it → server forces their own site.
        ...(canPickSite ? { siteId: siteId || null } : {}),
      });
      toast.success('Workflow created');
      reset();
      onClose();
      navigate(`/workflows/${result.workflow.id}/builder`);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to create workflow';
      toast.error(msg);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Create Workflow"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={create.isPending}
              disabled={create.isPending || !name.trim() || !typeId}
            >
              Create &amp; open builder
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CAPA Approval"
              autoFocus
              maxLength={200}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">
                Type <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setNewTypeOpen(true)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                <Plus size={12} />
                New type
              </button>
            </div>
            <Select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              disabled={typesLoading}
              placeholder="— Select a type —"
              options={types.map((t) => ({ value: t.id, label: t.name }))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Type provides the ticket-id prefix (e.g. <code>DOC</code>).
            </p>
          </div>
          {canPickSite && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Site</label>
              <Select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                options={[
                  { value: '', label: 'Global (all sites)' },
                  ...allowedSites.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
                ]}
              />
              <p className="text-xs text-gray-500 mt-1">
                <strong>Global</strong> is usable by every site. Pinning to a site limits
                this workflow — and its role/user pickers — to that site.
              </p>
            </div>
          )}
        </form>
      </Modal>

      <NewWorkflowTypeModal
        isOpen={newTypeOpen}
        onClose={() => setNewTypeOpen(false)}
        onCreated={(t) => {
          setTypeId(t.id);
          setNewTypeOpen(false);
        }}
      />
    </>
  );
}

interface NewTypeProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (type: { id: string; name: string }) => void;
}

function NewWorkflowTypeModal({ isOpen, onClose, onCreated }: NewTypeProps) {
  const [typeName, setTypeName] = useState('');
  const [codePrefix, setCodePrefix] = useState('');
  const [iconName, setIconName] = useState('');
  const createType = useCreateWorkflowType();

  const reset = () => {
    setTypeName('');
    setCodePrefix('');
    setIconName('');
  };

  const handleClose = () => {
    if (createType.isPending) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = typeName.trim();
    const trimmedPrefix = codePrefix.trim().toUpperCase();
    const trimmedIcon = iconName.trim();
    if (!trimmedName) return toast.error('Name is required');
    try {
      const t = await createType.mutateAsync({
        name: trimmedName,
        ...(trimmedPrefix ? { codePrefix: trimmedPrefix } : {}),
        ...(trimmedIcon ? { iconName: trimmedIcon } : {}),
      });
      toast.success('Type created');
      onCreated({ id: t.id, name: t.name });
      reset();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to create type';
      toast.error(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Workflow Type"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={createType.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={createType.isPending}
            disabled={createType.isPending || !typeName.trim()}
          >
            Create
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
          <Input
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            placeholder="e.g. Document"
            autoFocus
            maxLength={250}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Code prefix <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <Input
            value={codePrefix}
            onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
            placeholder="DOC"
            maxLength={20}
            className="font-mono uppercase"
          />
          <p className="text-xs text-gray-500 mt-1">
            Used in ticket IDs like <code>DOC-FQS-001</code>.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Icon <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <Input
            value={iconName}
            onChange={(e) => setIconName(e.target.value)}
            placeholder="e.g. FileText"
            maxLength={100}
          />
        </div>
      </form>
    </Modal>
  );
}
