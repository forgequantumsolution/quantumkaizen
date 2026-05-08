import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Input, Select, Modal } from '@/components/ui';
import { useCreateWorkflow } from '@/lib/api/workflow';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateWorkflowModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState('');
  const { data: types = [], isLoading: typesLoading } = useWorkflowTypes();
  const create = useCreateWorkflow();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        typeId: typeId || null,
      });
      toast.success('Workflow created');
      onClose();
      setName('');
      setTypeId('');
      navigate(`/workflows/${result.workflow.id}/builder`);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to create workflow';
      toast.error(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Workflow"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={create.isPending}
            disabled={create.isPending || !name.trim()}
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
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Type <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <Select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            disabled={typesLoading}
            placeholder="— No type —"
            options={types.map((t) => ({ value: t.id, label: t.name }))}
          />
          <p className="text-xs text-gray-500 mt-1">
            Type provides the ticket-id prefix (e.g. <code>DOC</code>).
          </p>
        </div>
      </form>
    </Modal>
  );
}
