/**
 * Builder-side approval-policy editor.
 *
 * Modal that creates or updates the `ApprovalPolicy` attached to a single
 * (stage, action) tuple. The caller passes the persisted stage UUID and
 * action UUID; only saved nodes can be configured (the inspector hides the
 * "Configure" button until the workflow is saved).
 *
 * SEQUENTIAL mode's `approvalSequence` is intentionally not edited here —
 * the form is already busy and most policies don't use it. Use the API
 * directly to set up sequential ordering until we ship a dedicated builder.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import {
  useApprovalPoliciesForWorkflow,
  useCreateApprovalPolicy,
  useDeleteApprovalPolicy,
  useUpdateApprovalPolicy,
  type ApprovalMode,
  type CreateApprovalPolicyBody,
} from '@/lib/api/approval';
import { useRoles } from '@/features/admin/roles/hooks';
import { useAdminUsers } from '@/features/admin/users/hooks';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  stageId: string;
  actionId: string;
  /** Display label — e.g. "Approve" or "Reject" — shown in the modal header. */
  actionLabel?: string;
}

const MODES: ApprovalMode[] = ['SINGLE', 'ALL_REQUIRED', 'QUORUM', 'SEQUENTIAL', 'ANY'];

const explainMode = (m: ApprovalMode): string => {
  switch (m) {
    case 'SINGLE':
      return 'One approver decides — fastest, no quorum logic.';
    case 'ALL_REQUIRED':
      return 'Every listed approver must approve. One rejection ends it.';
    case 'QUORUM':
      return 'N of M approvals required. Configure N below.';
    case 'SEQUENTIAL':
      return 'Approvers act in order — the next approver is unlocked once the previous decides. (Sequence config via API.)';
    case 'ANY':
      return 'First decision (approve or reject) wins.';
  }
};

export default function ApprovalPolicyEditor({
  isOpen,
  onClose,
  workflowId,
  stageId,
  actionId,
  actionLabel,
}: Props) {
  const { data: policies = [] } = useApprovalPoliciesForWorkflow(workflowId, {
    includeInactive: true,
  });
  const existing = useMemo(
    () => policies.find((p) => p.stage.id === stageId && p.action.id === actionId),
    [policies, stageId, actionId],
  );

  const { data: rolesData } = useRoles({ pageSize: 200 });
  const { data: usersData } = useAdminUsers({ pageSize: 200, isActive: true });
  const roles = rolesData?.items ?? [];
  const users = usersData?.items ?? [];

  const [mode, setMode] = useState<ApprovalMode>('SINGLE');
  const [requiredCount, setRequiredCount] = useState(1);
  const [strictRoleMatch, setStrictRoleMatch] = useState(false);
  const [allowSelfApproval, setAllowSelfApproval] = useState(false);
  const [requireUniqueApprovers, setRequireUniqueApprovers] = useState(true);
  const [approvalSlaHours, setApprovalSlaHours] = useState<string>('');
  const [approverRoleIds, setApproverRoleIds] = useState<string[]>([]);
  const [approverUserIds, setApproverUserIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Hydrate the form from the existing policy when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    if (existing) {
      setMode(existing.mode);
      setRequiredCount(existing.requiredCount);
      setStrictRoleMatch(existing.strictRoleMatch);
      setAllowSelfApproval(existing.allowSelfApproval);
      setRequireUniqueApprovers(existing.requireUniqueApprovers);
      setApprovalSlaHours(
        existing.approvalSlaHours == null ? '' : String(existing.approvalSlaHours),
      );
      setApproverRoleIds(existing.approverRoles.map((r) => r.id));
      setApproverUserIds(existing.approverUsers.map((u) => u.id));
      setIsActive(existing.isActive);
    } else {
      setMode('SINGLE');
      setRequiredCount(1);
      setStrictRoleMatch(false);
      setAllowSelfApproval(false);
      setRequireUniqueApprovers(true);
      setApprovalSlaHours('');
      setApproverRoleIds([]);
      setApproverUserIds([]);
      setIsActive(true);
    }
  }, [isOpen, existing]);

  const create = useCreateApprovalPolicy(workflowId);
  const update = useUpdateApprovalPolicy(existing?.id ?? '');
  const remove = useDeleteApprovalPolicy();

  const submit = async () => {
    const slaHoursParsed = approvalSlaHours.trim() === '' ? null : Number(approvalSlaHours);
    if (slaHoursParsed != null && (!Number.isFinite(slaHoursParsed) || slaHoursParsed <= 0)) {
      toast.error('Approval SLA must be a positive number of hours');
      return;
    }
    if (mode !== 'SEQUENTIAL' && approverRoleIds.length + approverUserIds.length === 0) {
      toast.error('Pick at least one approver role or user');
      return;
    }
    if (mode === 'QUORUM' && requiredCount < 1) {
      toast.error('QUORUM mode requires `requiredCount` ≥ 1');
      return;
    }

    try {
      if (existing) {
        await update.mutateAsync({
          mode,
          requiredCount,
          strictRoleMatch,
          allowSelfApproval,
          requireUniqueApprovers,
          approvalSlaHours: slaHoursParsed,
          approverRoleIds,
          approverUserIds,
          isActive,
        });
        toast.success('Approval policy updated');
      } else {
        const body: CreateApprovalPolicyBody = {
          stageId,
          actionId,
          mode,
          requiredCount,
          strictRoleMatch,
          allowSelfApproval,
          requireUniqueApprovers,
          approvalSlaHours: slaHoursParsed,
          approverRoleIds,
          approverUserIds,
          isActive,
        };
        await create.mutateAsync(body);
        toast.success('Approval policy created');
      }
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to save policy';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm('Remove approval requirement for this action?')) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success('Approval policy removed');
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to delete';
      toast.error(msg);
    }
  };

  const toggle = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const isSubmitting = create.isPending || update.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${existing ? 'Edit' : 'Add'} approval policy${actionLabel ? ` — ${actionLabel}` : ''}`}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Mode</label>
          <Select
            value={mode}
            onChange={(e) => setMode(e.target.value as ApprovalMode)}
            options={MODES.map((m) => ({ value: m, label: m }))}
          />
          <p className="text-xs text-gray-500 mt-1">{explainMode(mode)}</p>
        </div>

        {mode === 'QUORUM' && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Required approvals
            </label>
            <Input
              type="number"
              min="1"
              value={requiredCount}
              onChange={(e) => setRequiredCount(Math.max(1, Number(e.target.value)))}
            />
          </div>
        )}

        {mode !== 'SEQUENTIAL' && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Approver roles
              </label>
              <div className="max-h-32 overflow-auto border border-gray-200 rounded p-2 space-y-1">
                {roles.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No roles defined.</p>
                )}
                {roles.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={approverRoleIds.includes(r.id)}
                      onChange={() => setApproverRoleIds((arr) => toggle(arr, r.id))}
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Approver users
              </label>
              <div className="max-h-32 overflow-auto border border-gray-200 rounded p-2 space-y-1">
                {users.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No users available.</p>
                )}
                {users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={approverUserIds.includes(u.id)}
                      onChange={() => setApproverUserIds((arr) => toggle(arr, u.id))}
                    />
                    <span>
                      {u.name}{' '}
                      <span className="text-gray-400 text-xs">({u.email})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Approval SLA (hours)
          </label>
          <Input
            type="number"
            min="0"
            placeholder="optional — e.g. 48"
            value={approvalSlaHours}
            onChange={(e) => setApprovalSlaHours(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Pending approvals expire after this many hours. Leave blank for no
            deadline.
          </p>
        </div>

        <div className="space-y-2 text-sm text-gray-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={strictRoleMatch}
              onChange={(e) => setStrictRoleMatch(e.target.checked)}
            />
            <span>Strict role match (require role at decide-time too)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowSelfApproval}
              onChange={(e) => setAllowSelfApproval(e.target.checked)}
            />
            <span>Allow ticket creator to approve their own request</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requireUniqueApprovers}
              onChange={(e) => setRequireUniqueApprovers(e.target.checked)}
            />
            <span>Require unique approvers (one decision per user)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Active (enforce on transitions)</span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          {existing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              isLoading={remove.isPending}
              disabled={remove.isPending || isSubmitting}
            >
              <Trash2 size={14} className="text-red-500" />
              <span className="ml-1 text-red-600">Remove policy</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              {existing ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
