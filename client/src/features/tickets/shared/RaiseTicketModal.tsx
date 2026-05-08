import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { useRaiseTicket } from '@/lib/api/ticket';
import { useWorkflows } from '@/lib/api/workflow';
import { usePriorities } from '@/lib/api/workflowLookups';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function RaiseTicketModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [workflowId, setWorkflowId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priorityId, setPriorityId] = useState('');

  const { data: workflowsData, isLoading: loadingWorkflows } = useWorkflows({
    status: 'ACTIVE',
    pageSize: 100,
  });
  const { data: priorities = [] } = usePriorities();
  const raise = useRaiseTicket();

  const activeWorkflows = (workflowsData?.items ?? []).filter(
    (w) => w.workflowStatus === 'ACTIVE',
  );

  const handleSubmit = async () => {
    if (!workflowId) return toast.error('Pick a workflow');
    if (!title.trim()) return toast.error('Title is required');
    try {
      const result = await raise.mutateAsync({
        workflowId,
        title: title.trim(),
        description: description.trim() || undefined,
        priorityId: priorityId || null,
      });
      toast.success(`Ticket ${result.uniqueId} raised`);
      reset();
      onClose();
      navigate(`/tickets/${result.ticketId}`);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to raise ticket';
      toast.error(msg);
    }
  };

  const reset = () => {
    setWorkflowId('');
    setTitle('');
    setDescription('');
    setPriorityId('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Raise Ticket"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={raise.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={raise.isPending}
            disabled={raise.isPending || !workflowId || !title.trim()}
          >
            Raise ticket
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Workflow</label>
          <Select
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            disabled={loadingWorkflows}
            placeholder={loadingWorkflows ? 'Loading...' : '— Pick an active workflow —'}
            options={activeWorkflows.map((w) => ({
              value: w.id,
              label: `${w.name}${w.type ? ` (${w.type.name})` : ''}`,
            }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 supplier audit"
            maxLength={250}
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief context..."
            maxLength={5000}
            rows={3}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Priority <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <Select
            value={priorityId}
            onChange={(e) => setPriorityId(e.target.value)}
            placeholder="— No priority —"
            options={priorities.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      </div>
    </Modal>
  );
}
