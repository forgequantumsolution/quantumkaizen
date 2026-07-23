import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, XCircle, Pause, Play, Undo2, UserCog, GitBranch } from 'lucide-react';
import { Button, Card, Input, Modal, Select, Textarea } from '@/components/ui';
import {
  useAllowedActions,
  useResumeTicket,
  useTicketTrack,
  useTransition,
  useStageChildTriggers,
  useSpawnChild,
  type AllowedAction,
  type StageActionsView,
  type StageChildTrigger,
} from '@/lib/api/ticket';
import type { StageActionBehavior } from '@/lib/api/workflow';
import { useTicketStageForms } from '@/lib/api/stageForm';

interface Props {
  ticketId: string;
  isOnHold: boolean;
  isCompleted: boolean;
  canTransition: boolean;
  /** Canonical id of the stage the user is viewing in the flow band. The "Raise
   *  child" buttons show only when this matches the stage they're configured on
   *  (or nothing is explicitly selected = the current stage). */
  selectedStageCanonicalId?: string | null;
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

export default function ActionBar({
  ticketId,
  isOnHold,
  isCompleted,
  canTransition,
  selectedStageCanonicalId = null,
}: Props) {
  const navigate = useNavigate();
  const { data: stageActions = [], isLoading } = useAllowedActions(ticketId);
  const { data: stageFormsData } = useTicketStageForms(ticketId);
  const { data: trackingRows = [] } = useTicketTrack(ticketId);
  const { data: childTriggersData } = useStageChildTriggers(ticketId, !isCompleted);
  const transition = useTransition(ticketId);
  const resume = useResumeTicket(ticketId);
  const spawnChild = useSpawnChild(ticketId);

  // Child-workflow triggers grouped by the stage they hang off.
  const triggersByStage = useMemo(() => {
    const map = new Map<string, StageChildTrigger[]>();
    for (const t of childTriggersData?.data ?? []) {
      const list = map.get(t.parent_stage_id) ?? [];
      list.push(t);
      map.set(t.parent_stage_id, list);
    }
    return map;
  }, [childTriggersData]);

  const [spawnFor, setSpawnFor] = useState<StageChildTrigger | null>(null);
  const [spawnTitle, setSpawnTitle] = useState('');
  const [spawnDesc, setSpawnDesc] = useState('');
  useEffect(() => {
    if (spawnFor) {
      setSpawnTitle(spawnFor.child_workflow_name);
      setSpawnDesc('');
    }
  }, [spawnFor]);

  const handleSpawn = async () => {
    if (!spawnFor) return;
    if (!spawnTitle.trim()) {
      toast.error('Enter a title');
      return;
    }
    try {
      const res = await spawnChild.mutateAsync({
        childWorkflowId: spawnFor.child_workflow_id,
        parentStageId: spawnFor.parent_stage_id,
        title: spawnTitle.trim(),
        description: spawnDesc.trim() || undefined,
      });
      toast.success(`${spawnFor.child_workflow_name} raised`);
      setSpawnFor(null);
      if (res?.ticketId) navigate(`/tickets/${res.ticketId}`);
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  // Phase 3.5 — block transitions when any required form on the current
  // stage is unsubmitted. The backend re-checks at /transition time (engine
  // form.layer); this is just the friendlier UX.
  const unsubmittedRequiredForms = useMemo(() => {
    const bindings = stageFormsData?.bindings ?? [];
    return bindings.filter(
      (b) => b.isRequired && b.latestSubmission?.status !== 'SUBMITTED',
    );
  }, [stageFormsData]);
  const formsBlocked = unsubmittedRequiredForms.length > 0;
  const formsBlockedReason = formsBlocked
    ? `Submit required forms first: ${unsubmittedRequiredForms
        .map((b) => b.form.title)
        .join(', ')}`
    : undefined;
  const [pending, setPending] = useState<{ action: AllowedAction; stage: StageActionsView } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [returnToStageId, setReturnToStageId] = useState('');

  // For RETURN actions, build the list of stages this ticket has previously
  // visited (excluding the current stage). The backend rejects targets the
  // ticket never visited, so this matches the server-side validation.
  const returnTargets = useMemo(() => {
    if (!pending || pending.action.behavior !== 'RETURN') return [];
    const seen = new Map<string, string>();
    for (const row of trackingRows) {
      if (!row.stageId) continue;
      if (row.stageId === pending.stage.stageId) continue;
      if (!seen.has(row.stageId)) seen.set(row.stageId, row.stageName);
    }
    return Array.from(seen, ([id, name]) => ({ value: id, label: name }));
  }, [pending, trackingRows]);

  useEffect(() => {
    setReturnToStageId('');
  }, [pending]);

  const errorMsg = (err: unknown) =>
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message ?? 'Action failed';

  const handlePerform = async () => {
    if (!pending) return;
    const isReturn = pending.action.behavior === 'RETURN';
    if (isReturn && !returnToStageId) {
      toast.error('Pick a stage to return to');
      return;
    }
    try {
      const res = await transition.mutateAsync({
        actionId: pending.action.id,
        remarks: remarks.trim() || undefined,
        returnToStageId: isReturn ? returnToStageId : undefined,
      });
      const msg =
        res.status === 'completed'
          ? 'Ticket completed'
          : res.status === 'rejected'
            ? 'Ticket rejected'
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
      <Card className="!px-3 !py-2">
        <p className="text-xs text-gray-600">
          <span className="font-semibold">Completed</span> — no further actions.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="!px-3 !py-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-700 uppercase tracking-wide">Stage Actions</span>
            <span>·</span>
            <span>Loading…</span>
          </div>
        ) : stageActions.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-700 uppercase tracking-wide">Stage Actions</span>
            <span>·</span>
            <span>No active stages.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {stageActions.map((stage) => {
              // UNHOLD actions are never usable from here: the engine rejects every
              // action while a ticket is on hold (`performAction` →
              // "Ticket is on hold; resume before transitioning"), so a configured
              // UNHOLD button can only render when the ticket ISN'T held — where
              // unholding is meaningless — and when it IS held it just duplicates
              // the universal Resume button below. Resume (POST /tickets/:id/resume)
              // is the only working path, so drop UNHOLD from the stage actions.
              const actions = stage.actions.filter((a) => a.behavior !== 'UNHOLD');
              return (
              <div key={stage.stageId} className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Stage Actions
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs font-medium text-gray-900 truncate">{stage.stageName}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 ml-auto">
                  {actions.length === 0 && !isOnHold && (
                    <span className="text-xs text-gray-400 italic">No actions configured</span>
                  )}
                  {actions.map((a) => {
                    const Icon = BEHAVIOR_ICON[a.behavior];
                    const disabled =
                      !a.canPerform || !canTransition || isOnHold || formsBlocked;
                    const tooltip = !a.canPerform
                      ? a.canPerformReason
                      : isOnHold
                        ? 'Ticket is on hold'
                        : formsBlocked
                          ? formsBlockedReason
                          : undefined;
                    return (
                      <Button
                        key={a.id}
                        variant={BEHAVIOR_VARIANT[a.behavior]}
                        size="sm"
                        disabled={disabled}
                        onClick={() => setPending({ action: a, stage })}
                        title={tooltip}
                      >
                        <Icon size={12} />
                        <span className="ml-1">{a.name}</span>
                      </Button>
                    );
                  })}
                  {isOnHold && (
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
                  )}
                  {/* Raise buttons only when this stage is the one being viewed
                      in the band (or no explicit selection = current stage). */}
                  {(!selectedStageCanonicalId ||
                    selectedStageCanonicalId === stage.stageCanonicalId) &&
                    (triggersByStage.get(stage.stageId) ?? []).map((t) => (
                      <Button
                        key={t.id}
                        variant="outline"
                        size="sm"
                        disabled={t.already_raised}
                        title={
                          t.already_raised
                            ? 'Already raised from this stage'
                            : `Raise a ${t.child_workflow_name} child ticket`
                        }
                        onClick={() => setSpawnFor(t)}
                      >
                        <GitBranch size={12} />
                        <span className="ml-1">Raise {t.child_workflow_name}</span>
                      </Button>
                    ))}
                </div>
              </div>
              );
            })}
          </div>
        )}
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
              disabled={
                transition.isPending ||
                (pending?.action.behavior === 'RETURN' &&
                  (returnTargets.length === 0 || !returnToStageId))
              }
            >
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-700 mb-3">
          Behavior: <span className="font-mono text-xs">{pending?.action.behavior}</span>
        </p>
        {pending?.action.behavior === 'RETURN' && (
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Return to stage <span className="text-red-500">*</span>
            </label>
            {returnTargets.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                No previously visited stage to return to.
              </p>
            ) : (
              <Select
                value={returnToStageId}
                onChange={(e) => setReturnToStageId(e.target.value)}
                placeholder="Select a stage"
                options={returnTargets}
              />
            )}
          </div>
        )}
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

      {/* Raise a child ticket from a configured stage trigger. */}
      <Modal
        isOpen={!!spawnFor}
        onClose={() => setSpawnFor(null)}
        title={spawnFor ? `Raise ${spawnFor.child_workflow_name}` : 'Raise child ticket'}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSpawnFor(null)} disabled={spawnChild.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSpawn}
              isLoading={spawnChild.isPending}
              disabled={spawnChild.isPending}
            >
              <GitBranch size={12} />
              <span className="ml-1">Raise</span>
            </Button>
          </div>
        }
      >
        {spawnFor && (
          <>
            <p className="text-sm text-gray-600 mb-3">
              Raises a{' '}
              <span className="font-medium text-gray-800">{spawnFor.child_workflow_name}</span>
              {spawnFor.child_module ? ` (${spawnFor.child_module})` : ''} ticket nested under this
              one, from stage <span className="font-medium">{spawnFor.stage_name}</span>.
            </p>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={spawnTitle}
              onChange={(e) => setSpawnTitle(e.target.value)}
              maxLength={250}
              className="mb-3"
            />
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <Textarea
              value={spawnDesc}
              onChange={(e) => setSpawnDesc(e.target.value)}
              placeholder="Context for the child ticket…"
              rows={3}
              maxLength={5000}
            />
          </>
        )}
      </Modal>
    </>
  );
}
