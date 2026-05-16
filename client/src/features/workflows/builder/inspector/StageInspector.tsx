import { useState } from 'react';
import { Pencil, Plus, Settings, ShieldCheck, Timer, Trash2 } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import type { StageNodeData, NodeAction } from '../builder.types';
import type { WorkflowStageStatus } from '@/lib/api/workflowLookups';
import { useApprovalPoliciesForWorkflow, type ApprovalPolicy } from '@/lib/api/approval';
import { useSlaPoliciesForWorkflow } from '@/lib/api/sla';
import ApprovalPolicyEditor from './ApprovalPolicyEditor';
import SlaPolicyEditor from './SlaPolicyEditor';

interface Props {
  workflowId: string;
  data: StageNodeData;
  onChange: (next: StageNodeData) => void;
  stageStatuses: WorkflowStageStatus[];
}

export default function StageInspector({
  workflowId,
  data,
  onChange,
  stageStatuses,
}: Props) {
  const [slaOpen, setSlaOpen] = useState(false);
  const [approvalEditFor, setApprovalEditFor] = useState<
    { actionId: string; actionLabel: string } | null
  >(null);

  const persistedStageId = data.persistedStageId;
  const { data: slaPolicies = [] } = useSlaPoliciesForWorkflow(workflowId);
  const { data: approvalPolicies = [] } = useApprovalPoliciesForWorkflow(workflowId, {
    includeInactive: true,
  });

  const slaForThisStage = persistedStageId
    ? slaPolicies.find((p) => p.parentStage.id === persistedStageId)
    : undefined;

  const approvalByActionId = new Map<string, ApprovalPolicy>(
    approvalPolicies
      .filter((p) => persistedStageId && p.stage.id === persistedStageId)
      .map((p) => [p.action.id, p]),
  );

  const update = <K extends keyof StageNodeData>(key: K, value: StageNodeData[K]) =>
    onChange({ ...data, [key]: value });

  const addAction = (kind: 'primary' | 'secondary') => {
    if (stageStatuses.length === 0) return;
    const first = stageStatuses[0]!;
    const newAction: NodeAction = {
      stage_status_id: first.id,
      stage_status_name: first.name,
      behavior: first.behavior,
      type: kind,
      roles_id: [],
      employees_id: [],
    };
    if (kind === 'primary') {
      update('primary_actions', [...(data.primary_actions ?? []), newAction]);
    } else {
      update('secondary_actions', [...(data.secondary_actions ?? []), newAction]);
    }
  };

  const updateAction = (
    kind: 'primary' | 'secondary',
    idx: number,
    patch: Partial<NodeAction>,
  ) => {
    const arr = (kind === 'primary' ? data.primary_actions : data.secondary_actions) ?? [];
    const next = arr.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    if (kind === 'primary') update('primary_actions', next);
    else update('secondary_actions', next);
  };

  const removeAction = (kind: 'primary' | 'secondary', idx: number) => {
    const arr = (kind === 'primary' ? data.primary_actions : data.secondary_actions) ?? [];
    const next = arr.filter((_, i) => i !== idx);
    if (kind === 'primary') update('primary_actions', next);
    else update('secondary_actions', next);
  };

  const renderActions = (kind: 'primary' | 'secondary') => {
    const arr = (kind === 'primary' ? data.primary_actions : data.secondary_actions) ?? [];
    return (
      <div className="space-y-2">
        {arr.length === 0 && (
          <p className="text-xs text-gray-400 italic">No {kind} actions yet.</p>
        )}
        {arr.map((a, i) => {
          const status = stageStatuses.find((s) => s.id === a.stage_status_id);
          return (
            <div key={i} className="flex gap-2 items-start">
              <Select
                value={a.stage_status_id}
                onChange={(e) => {
                  const s = stageStatuses.find((x) => x.id === e.target.value);
                  updateAction(kind, i, {
                    stage_status_id: e.target.value,
                    stage_status_name: s?.name,
                    behavior: s?.behavior,
                  });
                }}
                options={stageStatuses.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.behavior})`,
                }))}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAction(kind, i)}
                aria-label="remove action"
              >
                <Trash2 size={14} className="text-red-500" />
              </Button>
              {status && a.behavior !== status.behavior && (
                <span className="text-[10px] text-amber-600">behavior mismatch</span>
              )}
            </div>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => addAction(kind)}>
          <Plus size={14} />
          <span className="ml-1">Add {kind} action</span>
        </Button>
      </div>
    );
  };

  // ─── Approvals section ─────────────────────────────────────────────────────
  // Surfaces every SAVED action on this stage with its current approval policy
  // status. Unsaved actions are hidden — without an action UUID we can't bind
  // a policy. Mirrors the SLA section's design.
  const savedActions: { action: NodeAction; kind: 'primary' | 'secondary' }[] = [
    ...(data.primary_actions ?? []).map((a) => ({ action: a, kind: 'primary' as const })),
    ...(data.secondary_actions ?? []).map((a) => ({ action: a, kind: 'secondary' as const })),
  ].filter((row) => !!row.action.id);

  const renderApprovalRow = (
    action: NodeAction,
    kind: 'primary' | 'secondary',
    idx: number,
  ) => {
    const status = stageStatuses.find((s) => s.id === action.stage_status_id);
    const label = action.stage_status_name ?? status?.name ?? 'Action';
    const policy = action.id ? approvalByActionId.get(action.id) : undefined;
    return (
      <div
        key={`${kind}-${idx}-${action.id}`}
        className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
      >
        <ShieldCheck
          size={14}
          className={policy?.isActive ? 'text-green-600' : 'text-gray-300'}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 truncate">{label}</div>
          <div className="text-[11px] text-gray-500 truncate">
            {policy ? (
              <>
                <span className="font-medium text-gray-700">{policy.mode}</span>
                {!policy.isActive && <span className="text-gray-400"> · inactive</span>}
                {policy.approverRoles.length > 0 && (
                  <span> · {policy.approverRoles.map((r) => r.name).join(', ')}</span>
                )}
                {policy.approverUsers.length > 0 && policy.approverRoles.length === 0 && (
                  <span>
                    {' · '}
                    {policy.approverUsers.length} user
                    {policy.approverUsers.length === 1 ? '' : 's'}
                  </span>
                )}
              </>
            ) : (
              <span className="italic">No approval requirement</span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setApprovalEditFor({ actionId: action.id!, actionLabel: label })
          }
          aria-label={policy ? 'edit approval policy' : 'add approval policy'}
        >
          {policy ? (
            <>
              <Pencil size={12} />
              <span className="ml-1 text-xs">Edit</span>
            </>
          ) : (
            <>
              <Plus size={12} />
              <span className="ml-1 text-xs">Add policy</span>
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Stage name</label>
        <Input
          value={data.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder="e.g. Review"
          maxLength={100}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!data.is_initial_stage}
          onChange={(e) => update('is_initial_stage', e.target.checked)}
        />
        <span>Initial stage</span>
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!data.email_notification}
          onChange={(e) => update('email_notification', e.target.checked)}
        />
        <span>Send email notification</span>
      </label>

      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Primary actions
        </h4>
        {renderActions('primary')}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Secondary actions
        </h4>
        {renderActions('secondary')}
      </div>

      {/* ── Approvals ───────────────────────────────────────────────────── */}
      <div className="border-t pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <ShieldCheck size={12} />
          Approvals
        </h4>
        {!persistedStageId ? (
          <p className="text-xs text-gray-400 italic">
            Save the workflow first to configure approval policies on this stage's actions.
          </p>
        ) : savedActions.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            Add at least one action above (and save) to attach an approval policy.
          </p>
        ) : (
          <div className="rounded border border-gray-200 px-2">
            {savedActions.map(({ action, kind }, idx) =>
              renderApprovalRow(action, kind, idx),
            )}
          </div>
        )}
      </div>

      {/* ── SLA ─────────────────────────────────────────────────────────── */}
      <div className="border-t pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Timer size={12} />
          SLA
        </h4>
        {!persistedStageId ? (
          <p className="text-xs text-gray-400 italic">
            Save the workflow first to configure an SLA on this stage.
          </p>
        ) : slaForThisStage ? (
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-700">
              <div>
                Duration:{' '}
                <span className="font-medium">
                  {Math.round(slaForThisStage.duration / 360) / 10}h
                </span>
                {slaForThisStage.calendar && (
                  <span className="text-gray-500">
                    {' · '}
                    {slaForThisStage.calendar.name}
                  </span>
                )}
              </div>
              <div className="text-gray-500">
                {slaForThisStage.thresholds.length} threshold
                {slaForThisStage.thresholds.length === 1 ? '' : 's'}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSlaOpen(true)}>
              <Settings size={12} />
              <span className="ml-1">Edit</span>
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setSlaOpen(true)}>
            <Plus size={12} />
            <span className="ml-1">Add SLA</span>
          </Button>
        )}
      </div>

      {persistedStageId && (
        <SlaPolicyEditor
          isOpen={slaOpen}
          onClose={() => setSlaOpen(false)}
          workflowId={workflowId}
          stageId={persistedStageId}
          stageName={data.label}
        />
      )}

      {persistedStageId && approvalEditFor && (
        <ApprovalPolicyEditor
          isOpen={!!approvalEditFor}
          onClose={() => setApprovalEditFor(null)}
          workflowId={workflowId}
          stageId={persistedStageId}
          actionId={approvalEditFor.actionId}
          actionLabel={approvalEditFor.actionLabel}
        />
      )}
    </div>
  );
}
