/**
 * Canvas-state approval policy editor.
 *
 * Reads/writes an approval policy for a single (stage, action) tuple on the
 * canvas node. The parent supplies `value` (current policy or null) and
 * `onSave(next | null)`. The policy materialises as an `ApprovalPolicy` row
 * on Publish.
 *
 * SEQUENTIAL mode's `approvalSequence` field exists in the model but isn't
 * editable here — same as the previous version of this editor. Use the API
 * for sequence ordering.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { Select as AntSelect, Spin } from 'antd';
import { Button, Input, Modal, Select } from '@/components/ui';
import type { EmbeddedApprovalPolicy } from '../builder.types';
import { useRoles } from '@/features/admin/roles/hooks';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  actionLabel?: string;
  value: Omit<EmbeddedApprovalPolicy, 'actionType' | 'actionIndex'> | null;
  /** `null` removes the policy; otherwise persists the new shape. */
  onSave: (next: Omit<EmbeddedApprovalPolicy, 'actionType' | 'actionIndex'> | null) => void;
}

type ApprovalMode = EmbeddedApprovalPolicy['mode'];
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
  actionLabel,
  value,
  onSave,
}: Props) {
  // Search state for the two pickers (backend-driven, debounced).
  const [roleSearch, setRoleSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const debouncedRoleSearch = useDebouncedValue(roleSearch, 250);
  const debouncedUserSearch = useDebouncedValue(userSearch, 250);

  const { data: rolesData, isFetching: rolesFetching } = useRoles({
    search: debouncedRoleSearch || undefined,
    pageSize: 50,
  });
  const { data: usersData, isFetching: usersFetching } = useAdminUsers({
    search: debouncedUserSearch || undefined,
    isActive: true,
    pageSize: 50,
  });
  const roles = rolesData?.items ?? [];
  const users = usersData?.items ?? [];

  // Form fields.
  const [mode, setMode] = useState<ApprovalMode>('SINGLE');
  const [requiredCount, setRequiredCount] = useState(1);
  const [strictRoleMatch, setStrictRoleMatch] = useState(false);
  const [allowSelfApproval, setAllowSelfApproval] = useState(false);
  const [requireUniqueApprovers, setRequireUniqueApprovers] = useState(true);
  const [approvalSlaHours, setApprovalSlaHours] = useState<string>('');
  const [approverRoleIds, setApproverRoleIds] = useState<string[]>([]);
  const [approverUserIds, setApproverUserIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Label caches keep already-selected items in the dropdown options when the
  // current search page doesn't include them.
  const [roleLabelCache, setRoleLabelCache] = useState<Record<string, string>>({});
  const [userLabelCache, setUserLabelCache] = useState<Record<string, string>>({});

  useEffect(() => {
    if (roles.length === 0) return;
    setRoleLabelCache((prev) => {
      const next = { ...prev };
      for (const r of roles) next[r.id] = r.name;
      return next;
    });
  }, [roles]);
  useEffect(() => {
    if (users.length === 0) return;
    setUserLabelCache((prev) => {
      const next = { ...prev };
      for (const u of users) next[u.id] = `${u.name} (${u.email})`;
      return next;
    });
  }, [users]);

  // Hydrate from current value when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    if (value) {
      setMode(value.mode);
      setRequiredCount(value.requiredCount);
      setStrictRoleMatch(value.strictRoleMatch);
      setAllowSelfApproval(value.allowSelfApproval);
      setRequireUniqueApprovers(value.requireUniqueApprovers);
      setApprovalSlaHours(
        value.approvalSlaHours == null ? '' : String(value.approvalSlaHours),
      );
      setApproverRoleIds(value.approverRoleIds);
      setApproverUserIds(value.approverUserIds);
      setIsActive(value.isActive);
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
  }, [isOpen, value]);

  const submit = () => {
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

    onSave({
      mode,
      requiredCount,
      strictRoleMatch,
      allowSelfApproval,
      requireUniqueApprovers,
      approvalSlaHours: slaHoursParsed,
      approverRoleIds,
      approverUserIds,
      isActive,
      approvalSequence: value?.approvalSequence,
    });
    toast.success(value ? 'Approval policy updated' : 'Approval policy attached');
    onClose();
  };

  const handleDelete = () => {
    if (!value) return;
    if (!confirm('Remove approval requirement for this action?')) return;
    onSave(null);
    toast.success('Approval policy removed');
    onClose();
  };

  const roleOptions = useMemo(
    () => [
      ...roles.map((r) => ({ value: r.id, label: r.name })),
      ...approverRoleIds
        .filter((id) => !roles.some((r) => r.id === id))
        .map((id) => ({ value: id, label: roleLabelCache[id] ?? id })),
    ],
    [roles, approverRoleIds, roleLabelCache],
  );
  const userOptions = useMemo(
    () => [
      ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
      ...approverUserIds
        .filter((id) => !users.some((u) => u.id === id))
        .map((id) => ({ value: id, label: userLabelCache[id] ?? id })),
    ],
    [users, approverUserIds, userLabelCache],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${value ? 'Edit' : 'Add'} approval policy${actionLabel ? ` — ${actionLabel}` : ''}`}
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
              <AntSelect
                mode="multiple"
                allowClear
                showSearch
                style={{ width: '100%' }}
                placeholder="Search roles…"
                value={approverRoleIds}
                onChange={(vals: string[]) => setApproverRoleIds(vals)}
                onSearch={setRoleSearch}
                onBlur={() => setRoleSearch('')}
                filterOption={false}
                notFoundContent={
                  rolesFetching ? <Spin size="small" /> : <span>No roles match</span>
                }
                options={roleOptions}
                maxTagCount="responsive"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Approver users
              </label>
              <AntSelect
                mode="multiple"
                allowClear
                showSearch
                style={{ width: '100%' }}
                placeholder="Search users by name or email…"
                value={approverUserIds}
                onChange={(vals: string[]) => setApproverUserIds(vals)}
                onSearch={setUserSearch}
                onBlur={() => setUserSearch('')}
                filterOption={false}
                notFoundContent={
                  usersFetching ? <Spin size="small" /> : <span>No users match</span>
                }
                options={userOptions}
                maxTagCount="responsive"
              />
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
          {value ? (
            <Button variant="ghost" size="sm" onClick={handleDelete}>
              <Trash2 size={14} className="text-red-500" />
              <span className="ml-1 text-red-600">Remove policy</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit}>
              {value ? 'Save' : 'Attach'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
