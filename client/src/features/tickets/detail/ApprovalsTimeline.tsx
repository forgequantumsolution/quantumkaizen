/**
 * Full approval history for a ticket — pending + closed instances.
 *
 * Distinct from `ApprovalAwaitingCard`, which only surfaces PENDING instances
 * with a "Decide" action. This is the reference/audit view: one card per
 * `ApprovalInstance`, newest first, with the full records list inside.
 */
import { Check, X, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { Card, Spinner } from '@/components/ui';
import {
  useApprovalPoliciesForWorkflow,
  useTicketApprovals,
  type ApprovalInstance,
  type ApprovalInstanceStatus,
} from '@/lib/api/approval';
import { useTicket } from '@/lib/api/ticket';

interface Props {
  ticketId: string;
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const statusBadge = (status: ApprovalInstanceStatus) => {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', cls: 'bg-amber-100 text-amber-800', Icon: Clock };
    case 'SATISFIED':
      return { label: 'Approved', cls: 'bg-green-100 text-green-800', Icon: Check };
    case 'REJECTED':
      return { label: 'Rejected', cls: 'bg-red-100 text-red-800', Icon: X };
    case 'EXPIRED':
      return { label: 'Expired', cls: 'bg-gray-200 text-gray-700', Icon: AlertCircle };
    case 'INVALIDATED':
      return {
        label: 'Invalidated',
        cls: 'bg-gray-200 text-gray-700',
        Icon: AlertCircle,
      };
    case 'CANCELLED':
      return { label: 'Cancelled', cls: 'bg-gray-200 text-gray-700', Icon: AlertCircle };
  }
};

const InstanceBlock = ({ instance }: { instance: ApprovalInstance }) => {
  const badge = statusBadge(instance.status);
  const BadgeIcon = badge.Icon;

  const approvedCount = instance.records.filter((r) => r.decision === 'APPROVED').length;
  const showCount =
    instance.policy.mode !== 'SINGLE' && instance.policy.mode !== 'ANY';

  return (
    <Card className="!p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} className="text-gray-500" />
        <div className="text-sm font-medium text-gray-900 truncate">
          {instance.policy.action.workflowAction.name}
          <span className="text-gray-400"> · {instance.policy.stage.name}</span>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${badge.cls}`}
        >
          <BadgeIcon size={10} />
          {badge.label}
        </span>
      </div>

      <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>
          Mode: <span className="font-medium text-gray-700">{instance.policy.mode}</span>
        </span>
        {showCount && (
          <span>
            {approvedCount} of {instance.policy.requiredCount} approved
          </span>
        )}
        <span>Started {formatDateTime(instance.startedAt)}</span>
        {instance.completedAt && <span>Closed {formatDateTime(instance.completedAt)}</span>}
        {instance.deadlineAt && instance.status === 'PENDING' && (
          <span className="text-amber-700">Due {formatDateTime(instance.deadlineAt)}</span>
        )}
      </div>

      {instance.invalidatedReason && (
        <div className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 italic">
          {instance.invalidatedReason}
        </div>
      )}

      {instance.records.length === 0 ? (
        <div className="text-xs text-gray-400 italic">No decisions recorded yet.</div>
      ) : (
        <ol className="space-y-1.5 pt-1">
          {instance.records.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-xs">
              {r.decision === 'APPROVED' ? (
                <Check size={14} className="text-green-700 mt-0.5 flex-shrink-0" />
              ) : (
                <X size={14} className="text-red-700 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div>
                  <span
                    className={
                      r.decision === 'APPROVED'
                        ? 'text-green-800 font-medium'
                        : 'text-red-800 font-medium'
                    }
                  >
                    {r.approver?.name ?? r.approver?.email ?? '—'}
                  </span>{' '}
                  <span className="text-gray-700">
                    {r.decision === 'APPROVED' ? 'approved' : 'rejected'}
                  </span>
                  {r.approvedAsRole?.name && (
                    <span className="text-gray-500"> as {r.approvedAsRole.name}</span>
                  )}
                  <span className="text-gray-400"> · {formatDateTime(r.decidedAt)}</span>
                </div>
                {r.comment && (
                  <p className="text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                    {r.comment}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
};

/**
 * Newest-first list of all approval instances on a ticket. Returns an empty
 * state when there are none (this ticket's workflow never required approval).
 */
export default function ApprovalsTimeline({ ticketId }: Props) {
  const { data, isLoading, error } = useTicketApprovals(ticketId);
  const { data: ticket } = useTicket(ticketId);
  const workflowId = ticket?.flows[0]?.workflowId;
  const { data: policies } = useApprovalPoliciesForWorkflow(workflowId);

  if (isLoading)
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  if (error)
    return (
      <Card>
        <p className="text-sm text-red-600">Failed to load approvals.</p>
      </Card>
    );

  const instances = data ?? [];
  if (instances.length === 0) {
    const activePolicyCount = (policies ?? []).filter(
      (p) => p.isActive && !p.isDeleted,
    ).length;
    return (
      <Card>
        <div className="text-xs text-gray-500 px-2 py-5 space-y-2 text-center">
          {activePolicyCount === 0 ? (
            <>
              <p className="font-medium text-gray-700">No approvals on this ticket.</p>
              <p>
                This workflow has no approval policies configured, so its actions
                run through directly without an approval gate.
              </p>
            </>
          ) : (
            <p>
              No approval decisions yet — approvals will appear here once a gated
              action is performed.
            </p>
          )}
        </div>
      </Card>
    );
  }

  // Sort newest first by startedAt.
  const sorted = [...instances].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  return (
    <div className="space-y-2">
      {sorted.map((i) => (
        <InstanceBlock key={i.id} instance={i} />
      ))}
    </div>
  );
}
