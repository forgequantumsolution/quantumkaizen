/**
 * Second-person approval on a risk.
 *
 * When a level sets `requiresApproval`, the residual risk cannot be accepted on
 * the risk owner's signature alone — someone else has to approve it first. This
 * is the surface for that: request an approval, and (as a different person)
 * decide it under e-signature.
 *
 * The two rules that shape the UI are both enforced server-side as well, because
 * a client-side-only segregation of duties is not one:
 *   - the requester cannot decide their own request
 *   - the approver cannot be the person who later accepts
 *
 * Renders nothing when the risk's level does not demand approval and no request
 * has ever been raised, so ordinary risks are unaffected.
 */
import { useState } from 'react';
import { Button, Form, Input, Tooltip, message } from 'antd';
import { BadgeCheck, ShieldQuestion, X } from 'lucide-react';
import { Card } from '@/components/ui';
import ESignatureModal from '@/components/shared/ESignatureModal';
import { useHasPermission, useAuthStore } from '@/stores/authStore';
import {
  useRiskApprovals,
  useRequestRiskApproval,
  useDecideRiskApproval,
  type RiskApproval,
} from '@/lib/api/risk';

const extractErr = (err: unknown): string => {
  const res = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
    ?.response?.data;
  return res?.error?.message ?? res?.message ?? (err as { message?: string })?.message ?? 'Operation failed';
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${
        STATUS_STYLE[status] ?? 'bg-gray-50 text-gray-700 border-gray-200'
      }`}
    >
      {status}
    </span>
  );
}

export default function RiskApprovalPanel({
  riskId,
  requiresApproval,
}: {
  riskId: string;
  /** From the level's policy — drives whether the empty state is shown at all. */
  requiresApproval: boolean;
}) {
  const canRequest = useHasPermission('risk.update');
  const canDecide = useHasPermission('risk.accept');
  const myId = useAuthStore((s) => s.user?.id);

  const { data: approvals = [], isLoading } = useRiskApprovals(riskId);
  const requestMut = useRequestRiskApproval(riskId);
  const decideMut = useDecideRiskApproval(riskId);

  const [form] = Form.useForm<{ comment?: string }>();
  const [signing, setSigning] = useState<{ approval: RiskApproval; decision: 'APPROVED' | 'REJECTED' } | null>(null);

  const pending = approvals.find((a) => a.status === 'PENDING');

  // Nothing to say: the level does not require approval and none was ever asked for.
  if (!requiresApproval && approvals.length === 0) return null;

  const request = async () => {
    const v = await form.getFieldsValue();
    try {
      await requestMut.mutateAsync({ comment: v.comment?.trim() || null });
      form.resetFields();
      message.success('Approval requested');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const decide = async (credential: string, meaning: string, comment: string) => {
    if (!signing) return;
    try {
      await decideMut.mutateAsync({
        approvalId: signing.approval.id,
        decision: signing.decision,
        credential,
        meaning,
        comment: comment?.trim() || null,
      });
      setSigning(null);
      message.success(`Approval ${signing.decision.toLowerCase()}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <ShieldQuestion size={15} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Second-person approval</h3>
      </div>

      {requiresApproval && (
        <p className="mb-3 text-xs text-gray-500">
          This risk sits at a level that requires approval by someone other than the person
          accepting it. Acceptance is blocked until that approval is recorded.
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : approvals.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">No approval has been requested yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-gray-50">
          {approvals.map((a) => {
            const isMine = !!myId && a.requested_by_id === myId;
            return (
              <li key={a.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <StatusChip status={a.status} />
                  <span className="text-[11px] text-gray-400">
                    {a.status === 'PENDING' ? `Requested ${fmt(a.requested_at)}` : `Decided ${fmt(a.decided_at)}`}
                  </span>
                </div>
                {a.comment && <p className="mt-1 text-xs text-gray-600">{a.comment}</p>}
                {a.level_code && (
                  <p className="mt-0.5 text-[11px] text-gray-400">Requested at level {a.level_code}</p>
                )}

                {a.status === 'PENDING' && canDecide && (
                  <div className="mt-2 flex gap-2">
                    <Tooltip
                      title={isMine ? 'You raised this request — a second person must decide it' : ''}
                    >
                      <span>
                        <Button
                          size="small"
                          type="primary"
                          disabled={isMine}
                          icon={<BadgeCheck size={13} />}
                          onClick={() => setSigning({ approval: a, decision: 'APPROVED' })}
                        >
                          Approve
                        </Button>
                      </span>
                    </Tooltip>
                    <Button
                      size="small"
                      danger
                      disabled={isMine}
                      icon={<X size={13} />}
                      onClick={() => setSigning({ approval: a, decision: 'REJECTED' })}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canRequest && !pending && (
        <Form form={form} layout="vertical">
          <Form.Item name="comment" label="Request approval" className="mb-2">
            <Input.TextArea rows={2} placeholder="Why this risk is being put forward for approval" />
          </Form.Item>
          <Button size="small" loading={requestMut.isPending} onClick={request}>
            Request approval
          </Button>
        </Form>
      )}

      <ESignatureModal
        isOpen={!!signing}
        onClose={() => setSigning(null)}
        onSign={decide}
        entityType="Risk"
        entityId={riskId}
        isLoading={decideMut.isPending}
      />
    </Card>
  );
}
