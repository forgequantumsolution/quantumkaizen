/**
 * Approver-facing modal: approve or reject a PENDING approval instance.
 *
 * Calls `POST /api/approvals/:instanceId/decide` via `useDecideApproval`.
 * On REJECTED + unsatisfiable policy: instance flips REJECTED, ticket stays
 * in stage (Q5). On APPROVED + satisfied: caller still needs to invoke the
 * underlying action via `/transition` to actually advance the ticket.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Modal, Textarea } from '@/components/ui';
import {
  useDecideApproval,
  type ApprovalDecision,
  type ApprovalInstance,
} from '@/lib/api/approval';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  instance: ApprovalInstance;
}

export default function ApprovalDecideModal({ isOpen, onClose, instance }: Props) {
  const [decision, setDecision] = useState<ApprovalDecision>('APPROVED');
  const [comment, setComment] = useState('');
  const decide = useDecideApproval(instance.id, instance.ticketId);

  const submit = async () => {
    if (comment.length > 500) {
      toast.error('Comment must be ≤ 500 characters');
      return;
    }
    try {
      const result = await decide.mutateAsync({
        decision,
        comment: comment.trim() || undefined,
      });
      if (result.status === 'SATISFIED') {
        toast.success('Approved — re-invoke the action to advance the ticket');
      } else if (result.status === 'REJECTED') {
        toast.success('Rejected — ticket stays in this stage');
      } else {
        toast.success('Decision recorded — waiting for more approvers');
      }
      setComment('');
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to record decision';
      toast.error(msg);
    }
  };

  const action = instance.policy.action.workflowAction;
  const stage = instance.policy.stage;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Decide approval">
      <div className="space-y-3">
        <div className="text-xs text-gray-600 space-y-0.5">
          <div>
            <span className="text-gray-400">Action:</span> {action.name}
          </div>
          <div>
            <span className="text-gray-400">Stage:</span> {stage.name}
          </div>
          <div>
            <span className="text-gray-400">Mode:</span> {instance.policy.mode}{' '}
            {instance.policy.mode === 'QUORUM' && `(${instance.policy.requiredCount} required)`}
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={decision === 'APPROVED'}
              onChange={() => setDecision('APPROVED')}
            />
            <span className="text-green-700">Approve</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={decision === 'REJECTED'}
              onChange={() => setDecision('REJECTED')}
            />
            <span className="text-red-700">Reject</span>
          </label>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700">
            Comment <span className="text-gray-400">(optional, max 500)</span>
          </label>
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              decision === 'REJECTED'
                ? 'Why is this being rejected?'
                : 'Optional note'
            }
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={decision === 'REJECTED' ? 'danger' : 'primary'}
            onClick={submit}
            isLoading={decide.isPending}
            disabled={decide.isPending}
          >
            {decision === 'REJECTED' ? 'Reject' : 'Approve'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
