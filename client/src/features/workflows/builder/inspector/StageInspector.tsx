/**
 * Stage inspector — Phase 3.5+ canvas-state architecture.
 *
 * The three policy sections (Approvals, SLA, Forms) source from the node's
 * own data (`data.approvalPolicies`, `data.sla`, `data.formBindings`). The
 * editors write back through `onChange`. Nothing in this inspector POSTs to
 * the policy CRUD endpoints — policies materialise on Publish via
 * `workflow.builder.buildWorkflowGraph`. See WORKFLOW_PHASE_3_5_PLAN.md.
 */
import { useState } from 'react';
import {
  ClipboardList,
  FileText,
  Pencil,
  Plus,
  ShieldCheck,
  Timer,
  Trash2,
} from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import type {
  EmbeddedApprovalPolicy,
  NodeAction,
  StageNodeData,
} from '../builder.types';
import type { WorkflowStageStatus } from '@/lib/api/workflowLookups';
import ApprovalPolicyEditor from './ApprovalPolicyEditor';
import SlaPolicyEditor from './SlaPolicyEditor';
import StageFormBindingEditor from './StageFormBindingEditor';

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
  const [formBindingOpen, setFormBindingOpen] = useState(false);
  const [approvalEditFor, setApprovalEditFor] = useState<
    {
      actionType: 'primary' | 'secondary';
      actionIndex: number;
      actionLabel: string;
    } | null
  >(null);

  const formBindings = data.formBindings ?? [];
  const sla = data.sla ?? null;
  const approvalPolicies = data.approvalPolicies ?? [];

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
    // Drop any approval policies that were attached to the removed action;
    // also re-index policies on later actions of the same type.
    const remaining = (data.approvalPolicies ?? [])
      .filter((p) => !(p.actionType === kind && p.actionIndex === idx))
      .map((p) =>
        p.actionType === kind && p.actionIndex > idx
          ? { ...p, actionIndex: p.actionIndex - 1 }
          : p,
      );
    if (remaining.length !== (data.approvalPolicies ?? []).length) {
      update('approvalPolicies', remaining);
    }
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
  // One row per action that has a policy + an "Add policy" row per action without.
  type ActionRef = { type: 'primary' | 'secondary'; index: number; label: string };
  const allActionRefs: ActionRef[] = [
    ...(data.primary_actions ?? []).map((a, i) => ({
      type: 'primary' as const,
      index: i,
      label: a.stage_status_name ?? 'Action',
    })),
    ...(data.secondary_actions ?? []).map((a, i) => ({
      type: 'secondary' as const,
      index: i,
      label: a.stage_status_name ?? 'Action',
    })),
  ];

  const findPolicy = (
    ref: ActionRef,
  ): EmbeddedApprovalPolicy | undefined =>
    approvalPolicies.find(
      (p) => p.actionType === ref.type && p.actionIndex === ref.index,
    );

  const upsertApprovalPolicy = (
    ref: ActionRef,
    next: EmbeddedApprovalPolicy | null,
  ) => {
    const filtered = approvalPolicies.filter(
      (p) => !(p.actionType === ref.type && p.actionIndex === ref.index),
    );
    update('approvalPolicies', next ? [...filtered, next] : filtered);
  };

  const renderApprovalRow = (ref: ActionRef) => {
    const policy = findPolicy(ref);
    return (
      <div
        key={`${ref.type}-${ref.index}-${ref.label}`}
        className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
      >
        <ShieldCheck
          size={14}
          className={policy?.isActive ? 'text-green-600' : 'text-gray-300'}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 truncate">{ref.label}</div>
          <div className="text-[11px] text-gray-500 truncate">
            {policy ? (
              <>
                <span className="font-medium text-gray-700">{policy.mode}</span>
                {!policy.isActive && <span className="text-gray-400"> · inactive</span>}
                {policy.approverRoleIds.length > 0 && (
                  <span> · {policy.approverRoleIds.length} role(s)</span>
                )}
                {policy.approverUserIds.length > 0 && (
                  <span> · {policy.approverUserIds.length} user(s)</span>
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
            setApprovalEditFor({
              actionType: ref.type,
              actionIndex: ref.index,
              actionLabel: ref.label,
            })
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
        {allActionRefs.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            Add at least one action above to attach an approval policy.
          </p>
        ) : (
          <div className="rounded border border-gray-200 px-2">
            {allActionRefs.map(renderApprovalRow)}
          </div>
        )}
      </div>

      {/* ── SLA ─────────────────────────────────────────────────────────── */}
      <div className="border-t pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Timer size={12} />
          SLA
        </h4>
        {sla ? (
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-700">
              <div>
                Duration:{' '}
                <span className="font-medium">
                  {Math.round(sla.duration / 360) / 10}h
                </span>
              </div>
              <div className="text-gray-500">
                {sla.thresholds.length} threshold
                {sla.thresholds.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setSlaOpen(true)}>
                <Pencil size={12} />
                <span className="ml-1">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="remove sla"
                onClick={() => {
                  if (!confirm('Remove the SLA for this stage?')) return;
                  update('sla', null);
                }}
              >
                <Trash2 size={14} className="text-red-500" />
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setSlaOpen(true)}>
            <Plus size={12} />
            <span className="ml-1">Add SLA</span>
          </Button>
        )}
      </div>

      {/* ── Forms ──────────────────────────────────────────────────────── */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardList size={12} />
            Forms
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFormBindingOpen(true)}
          >
            <Plus size={12} />
            <span className="ml-1 text-xs">Attach form</span>
          </Button>
        </div>
        {formBindings.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            No forms attached. Required forms will block transitions until submitted.
          </p>
        ) : (
          <div className="rounded border border-gray-200 px-2">
            {formBindings.map((b, idx) => (
              <div
                key={`${b.formId}-${idx}`}
                className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
              >
                <FileText
                  size={14}
                  className={b.isRequired ? 'text-amber-600' : 'text-gray-300'}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {b.formTitle
                      ? `${b.formTitle}${b.formVersion ? ` (v${b.formVersion})` : ''}`
                      : `Form ${b.formId.substring(0, 8)}…`}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {b.isRequired ? 'Required to transition' : 'Optional'}
                    {' · position '}
                    {b.position}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="remove form binding"
                  onClick={() => {
                    if (!confirm('Detach this form from the stage?')) return;
                    update(
                      'formBindings',
                      formBindings.filter((_, i) => i !== idx),
                    );
                  }}
                >
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SlaPolicyEditor
        isOpen={slaOpen}
        onClose={() => setSlaOpen(false)}
        stageName={data.label}
        value={sla}
        onSave={(next) => update('sla', next)}
      />

      <StageFormBindingEditor
        isOpen={formBindingOpen}
        onClose={() => setFormBindingOpen(false)}
        stageName={data.label}
        existing={formBindings}
        onAdd={(b) => update('formBindings', [...formBindings, b])}
      />

      {approvalEditFor && (
        <ApprovalPolicyEditor
          isOpen={!!approvalEditFor}
          onClose={() => setApprovalEditFor(null)}
          workflowId={workflowId}
          actionLabel={approvalEditFor.actionLabel}
          value={
            findPolicy({
              type: approvalEditFor.actionType,
              index: approvalEditFor.actionIndex,
              label: approvalEditFor.actionLabel,
            }) ?? null
          }
          onSave={(next) =>
            upsertApprovalPolicy(
              {
                type: approvalEditFor.actionType,
                index: approvalEditFor.actionIndex,
                label: approvalEditFor.actionLabel,
              },
              next === null
                ? null
                : {
                    actionType: approvalEditFor.actionType,
                    actionIndex: approvalEditFor.actionIndex,
                    ...next,
                  },
            )
          }
        />
      )}
    </div>
  );
}
