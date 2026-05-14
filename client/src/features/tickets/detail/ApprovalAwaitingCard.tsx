/**
 * "Awaiting approval" card on the ticket detail page.
 *
 * Renders when there's a PENDING ApprovalInstance on the ticket. Shows:
 *   - Mode + records-so-far
 *   - Records list (who approved/rejected + comment + time)
 *   - "Decide" button — visible only to users eligible to act as an approver
 *     for this policy (matches by role name OR user id) AND who carry the
 *     `approval.decide` permission.
 *
 * Click "Decide" → `ApprovalDecideModal`.
 */
import { useMemo, useState } from 'react';
import { Check, X, ShieldCheck, Clock } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import {
  useTicketApprovals,
  type ApprovalInstance,
} from '@/lib/api/approval';
import ApprovalDecideModal from './ApprovalDecideModal';

interface Props {
  ticketId: string;
}

const timeAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const InstanceCard = ({ instance }: { instance: ApprovalInstance }) => {
  const [decideOpen, setDecideOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const hasDecide = useAuthStore((s) => s.user?.permissions.includes('approval.decide') ?? false);

  // Eligibility — user is an approver if their user-id is in approverUsers OR
  // their role name matches one of approverRoles.
  const isEligibleApprover = useMemo(() => {
    if (!user) return false;
    if (instance.policy.approverUsers.some((u) => u.id === user.id)) return true;
    if (instance.policy.approverRoles.some((r) => r.name === user.role)) return true;
    return false;
  }, [instance.policy.approverUsers, instance.policy.approverRoles, user]);

  const alreadyDecided = useMemo(
    () => user != null && instance.records.some((r) => r.approver?.id === user.id),
    [instance.records, user],
  );

  const canDecide = hasDecide && isEligibleApprover && !alreadyDecided;

  const approvedCount = instance.records.filter((r) => r.decision === 'APPROVED').length;
  const totalRequired = instance.policy.requiredCount;
  const stillNeeded = Math.max(0, totalRequired - approvedCount);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <ShieldCheck size={14} />
        <span>Awaiting approval</span>
        <span className="ml-auto text-xs font-normal text-amber-700">
          {instance.policy.mode}
          {instance.policy.mode !== 'SINGLE' &&
            instance.policy.mode !== 'ANY' &&
            ` · ${approvedCount} of ${totalRequired}`}
        </span>
      </div>

      <div className="text-xs text-amber-900/80">
        Action: <span className="font-medium">{instance.policy.action.workflowAction.name}</span>
        {' · '}Stage: <span className="font-medium">{instance.policy.stage.name}</span>
      </div>

      {stillNeeded > 0 && (
        <div className="text-xs text-amber-900">
          {stillNeeded} more {stillNeeded === 1 ? 'approver' : 'approvers'} required
          {instance.policy.approverRoles.length > 0 &&
            ` (${instance.policy.approverRoles.map((r) => r.name).join(', ')})`}
        </div>
      )}

      {instance.records.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="text-[11px] font-semibold text-amber-900/70 uppercase tracking-wide">
            Records
          </div>
          {instance.records.map((r) => (
            <div key={r.id} className="flex items-start gap-2 text-xs">
              {r.decision === 'APPROVED' ? (
                <Check size={14} className="text-green-700 mt-0.5" />
              ) : (
                <X size={14} className="text-red-700 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <span
                  className={
                    r.decision === 'APPROVED' ? 'text-green-800' : 'text-red-800'
                  }
                >
                  {r.approver?.name ?? r.approver?.email ?? '—'}{' '}
                  {r.decision === 'APPROVED' ? 'approved' : 'rejected'}
                </span>
                {r.approvedAsRole?.name && (
                  <span className="text-gray-500"> ({r.approvedAsRole.name})</span>
                )}
                <span className="text-gray-400"> · {timeAgo(r.decidedAt)}</span>
                {r.comment && <div className="text-gray-700 mt-0.5">{r.comment}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {canDecide ? (
        <Button variant="primary" size="sm" onClick={() => setDecideOpen(true)}>
          Decide
        </Button>
      ) : alreadyDecided ? (
        <div className="text-xs text-amber-900/70 flex items-center gap-1">
          <Clock size={11} />
          Your decision is recorded — waiting on others
        </div>
      ) : null}

      <ApprovalDecideModal
        isOpen={decideOpen}
        onClose={() => setDecideOpen(false)}
        instance={instance}
      />
    </div>
  );
};

/**
 * Renders one `InstanceCard` per PENDING ApprovalInstance on the ticket.
 * Returns `null` (renders nothing) when there are no pending instances —
 * lets the parent place this above the action bar without an empty box.
 */
export default function ApprovalAwaitingCard({ ticketId }: Props) {
  const { data, isLoading } = useTicketApprovals(ticketId);
  if (isLoading || !data) return null;
  const pending = data.filter((i) => i.status === 'PENDING');
  if (pending.length === 0) return null;

  return (
    <Card className="!p-3 space-y-2">
      {pending.map((i) => (
        <InstanceCard key={i.id} instance={i} />
      ))}
    </Card>
  );
}
