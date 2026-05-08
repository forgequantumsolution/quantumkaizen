import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, XCircle, Pause, Play, Undo2, UserCog } from 'lucide-react';
import { Button, Card, Modal, Textarea } from '@/components/ui';
import {
  useAllowedActions,
  useHoldTicket,
  useResumeTicket,
  useTransition,
  type AllowedAction,
  type StageActionsView,
} from '@/lib/api/ticket';
import type { StageActionBehavior } from '@/lib/api/workflow';

interface Props {
  ticketId: string;
  isOnHold: boolean;
  isCompleted: boolean;
  canTransition: boolean;
}

const BEHAVIOR_ICON: Record<StageActionBehavior, React.ElementType> = {
  FORWARD: ArrowRight,
  REJECT: XCircle,
  HOLD: Pause,
  UNHOLD: Play,
  RETURN: Undo2,
  REASSIGN: UserCog,
};

const BEHAVIOR_VARIANT: Record<StageActionBehavior, 'primary' | 'reject' | 'secondary' | 'outline'> = {
  FORWARD: 'primary',
  REJECT: 'reject',
  HOLD: 'outline',
  UNHOLD: 'secondary',
  RETURN: 'outline',
  REASSIGN: 'outline',
};

export default function ActionBar({ ticketId, isOnHold, isCompleted, canTransition }: Props) {
  const { data: stageActions = [], isLoading } = useAllowedActions(ticketId);
  const transition = useTransition(ticketId);
  const hold = useHoldTicket(ticketId);
  const resume = useResumeTicket(ticketId);
  const [pending, setPending] = useState<{ action: AllowedAction; stage: StageActionsView } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');

  const errorMsg = (err: unknown) =>
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message ?? 'Action failed';

  const handlePerform = async () => {
    if (!pending) return;
    try {
      const res = await transition.mutateAsync({
        actionId: pending.action.id,
        remarks: remarks.trim() || undefined,
      });
      const msg =
        res.status === 'completed'
          ? 'Ticket completed'
          : res.status === 'held'
            ? 'Ticket held'
            : `Moved to ${res.enteredStages.map((s) => s.name).join(', ') || 'next stage'}`;
      toast.success(msg);
      setPending(null);
      setRemarks('');
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  const handleHold = async () => {
    if (!holdReason.trim()) return toast.error('Reason is required');
    try {
      await hold.mutateAsync({ reason: holdReason.trim() });
      toast.success('Ticket on hold');
      setHoldOpen(false);
      setHoldReason('');
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  const handleResume = async () => {
    try {
      await resume.mutateAsync();
      toast.success('Ticket resumed');
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  if (isCompleted) {
    return (
      <Card className="!p-3">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Completed</span> — no further actions.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="!p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
              Stage actions
            </h3>
            {isLoading ? (
              <p className="text-xs text-gray-500">Loading...</p>
            ) : stageActions.length === 0 ? (
              <p className="text-xs text-gray-500">No active stages.</p>
            ) : (
              <div className="space-y-2">
                {stageActions.map((stage) => (
                  <div key={stage.stageId}>
                    <p className="text-xs font-medium text-gray-900 mb-1">{stage.stageName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stage.actions.length === 0 && (
                        <span className="text-xs text-gray-400 italic">No actions configured</span>
                      )}
                      {stage.actions.map((a) => {
                        const Icon = BEHAVIOR_ICON[a.behavior];
                        return (
                          <Button
                            key={a.id}
                            variant={BEHAVIOR_VARIANT[a.behavior]}
                            size="sm"
                            disabled={!a.canPerform || !canTransition || isOnHold}
                            onClick={() => setPending({ action: a, stage })}
                            title={
                              !a.canPerform
                                ? a.canPerformReason
                                : isOnHold
                                  ? 'Ticket is on hold'
                                  : undefined
                            }
                          >
                            <Icon size={12} />
                            <span className="ml-1">{a.name}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isOnHold ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResume}
                isLoading={resume.isPending}
                disabled={!canTransition}
              >
                <Play size={12} />
                <span className="ml-1">Resume</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHoldOpen(true)}
                disabled={!canTransition}
              >
                <Pause size={12} />
                <span className="ml-1">Hold</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Modal
        isOpen={!!pending}
        onClose={() => {
          setPending(null);
          setRemarks('');
        }}
        title={pending ? `${pending.action.name} — ${pending.stage.stageName}` : 'Action'}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setPending(null);
                setRemarks('');
              }}
              disabled={transition.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePerform}
              isLoading={transition.isPending}
              disabled={transition.isPending}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-700 mb-3">
          Behavior: <span className="font-mono text-xs">{pending?.action.behavior}</span>
        </p>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          Remarks <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <Textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Why this action?"
          rows={3}
          maxLength={2000}
        />
      </Modal>

      <Modal
        isOpen={holdOpen}
        onClose={() => {
          setHoldOpen(false);
          setHoldReason('');
        }}
        title="Hold ticket"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setHoldOpen(false);
                setHoldReason('');
              }}
              disabled={hold.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleHold}
              isLoading={hold.isPending}
              disabled={hold.isPending || !holdReason.trim()}
            >
              Hold
            </Button>
          </div>
        }
      >
        <label className="text-xs font-medium text-gray-700 mb-1 block">Reason</label>
        <Textarea
          value={holdReason}
          onChange={(e) => setHoldReason(e.target.value)}
          placeholder="Why are you holding this ticket?"
          rows={3}
          maxLength={2000}
        />
      </Modal>
    </>
  );
}
