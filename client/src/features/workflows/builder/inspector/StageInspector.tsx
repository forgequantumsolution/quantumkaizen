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
  Bell,
  ClipboardList,
  FileText,
  Flag,
  Pencil,
  Plus,
  ShieldCheck,
  Timer,
  Trash2,
  Zap,
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
  /** Owning site of the workflow (null = global) — scopes role/user pickers. */
  workflowSiteId?: string | null;
  data: StageNodeData;
  onChange: (next: StageNodeData) => void;
  stageStatuses: WorkflowStageStatus[];
}

// ─── Presentational building blocks (module-scope so inputs keep focus) ──────

interface SectionProps {
  icon: React.ElementType;
  title: string;
  color?: string;
  tint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}

function Section({
  icon: Icon,
  title,
  color = '#64748B',
  tint = '#F1F5F9',
  action,
  children,
  bodyClassName = 'p-3',
}: SectionProps) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/40">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: tint, color }}
          >
            <Icon size={13} strokeWidth={2} />
          </span>
          <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
            {title}
          </h4>
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

interface ToggleRowProps {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
  tint: string;
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  color,
  tint,
}: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors ${
        checked ? 'border-transparent' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
      style={checked ? { background: tint, borderColor: `${color}40` } : undefined}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: checked ? '#fff' : '#F8FAFC', color: checked ? color : '#94A3B8' }}
      >
        <Icon size={14} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-gray-800 leading-tight">
          {label}
        </span>
        <span className="block text-[10.5px] text-gray-500 leading-tight mt-0.5">
          {description}
        </span>
      </span>
      <span
        className="w-9 h-5 rounded-full p-0.5 shrink-0 transition-colors"
        style={{ background: checked ? color : '#CBD5E1' }}
      >
        <span
          className="block w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  );
}

// Dashed full-width "add" button used across sections.
function AddButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-gold-400 hover:text-gold-700 hover:bg-gold-50/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Plus size={14} />
      {label}
    </button>
  );
}

/** Compact "RoleA, UserB, +2" summary for a form binding's access list. */
const summariseAccess = (
  roles: { id: string; name: string }[] | undefined,
  users: { id: string; name: string }[] | undefined,
  emptyLabel = 'Everyone',
): string => {
  const names = [...(roles ?? []), ...(users ?? [])].map((r) => r.name);
  if (names.length === 0) return emptyLabel;
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown}, +${names.length - 2}` : shown;
};

export default function StageInspector({
  workflowId,
  workflowSiteId,
  data,
  onChange,
  stageStatuses,
}: Props) {
  const [slaOpen, setSlaOpen] = useState(false);
  const [formBindingOpen, setFormBindingOpen] = useState(false);
  // null → attaching a new form; number → editing the binding at that index.
  const [formEditIndex, setFormEditIndex] = useState<number | null>(null);
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
          <p className="text-[11px] text-gray-400 italic px-0.5">No {kind} actions yet.</p>
        )}
        {arr.map((a, i) => {
          const status = stageStatuses.find((s) => s.id === a.stage_status_id);
          const mismatch = status && a.behavior !== status.behavior;
          return (
            <div
              key={i}
              className="flex gap-1.5 items-center rounded-lg border border-gray-200 bg-gray-50/60 p-1.5"
            >
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
                className="flex-1 !bg-white"
              />
              <button
                type="button"
                onClick={() => removeAction(kind, i)}
                aria-label="remove action"
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
              {mismatch && (
                <span className="text-[10px] text-amber-600 shrink-0">mismatch</span>
              )}
            </div>
          );
        })}
        <AddButton label={`Add ${kind} action`} onClick={() => addAction(kind)} />
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
    <div className="space-y-3.5">
      {/* ── Basics ──────────────────────────────────────────────────────── */}
      <Section icon={Flag} title="Basics" color="#0EA5E9" tint="#E0F2FE">
        <div className="space-y-2.5">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">
              Stage name
            </label>
            <Input
              value={data.label}
              onChange={(e) => update('label', e.target.value)}
              placeholder="e.g. Review"
              maxLength={100}
            />
          </div>
          <ToggleRow
            icon={Flag}
            label="Initial stage"
            description="First step when a ticket is raised"
            checked={!!data.is_initial_stage}
            onChange={(v) => update('is_initial_stage', v)}
            color="#22C55E"
            tint="#F0FDF4"
          />
          <ToggleRow
            icon={Bell}
            label="Email notification"
            description="Notify assignees on entry"
            checked={!!data.email_notification}
            onChange={(v) => update('email_notification', v)}
            color="#C9A84C"
            tint="#FEFBF0"
          />
        </div>
      </Section>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <Section icon={Zap} title="Primary actions" color="#2563EB" tint="#EFF6FF">
        {renderActions('primary')}
      </Section>

      <Section icon={Zap} title="Secondary actions" color="#64748B" tint="#F1F5F9">
        {renderActions('secondary')}
      </Section>

      {/* ── Approvals ───────────────────────────────────────────────────── */}
      <Section
        icon={ShieldCheck}
        title="Approvals"
        color="#16A34A"
        tint="#F0FDF4"
        bodyClassName={allActionRefs.length === 0 ? 'p-3' : 'px-3 py-1'}
      >
        {allActionRefs.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic">
            Add at least one action above to attach an approval policy.
          </p>
        ) : (
          <div>{allActionRefs.map(renderApprovalRow)}</div>
        )}
      </Section>

      {/* ── SLA ─────────────────────────────────────────────────────────── */}
      <Section icon={Timer} title="SLA" color="#DC2626" tint="#FEF2F2">
        {sla ? (
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/60 p-2.5">
            <div className="text-xs text-gray-700">
              <div className="font-semibold text-gray-900">
                {Math.round(sla.duration / 360) / 10}h
                <span className="font-normal text-gray-400"> duration</span>
              </div>
              <div className="text-gray-500 mt-0.5">
                {sla.thresholds.length} threshold
                {sla.thresholds.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setSlaOpen(true)}>
                <Pencil size={12} />
                <span className="ml-1">Edit</span>
              </Button>
              <button
                type="button"
                aria-label="remove sla"
                onClick={() => {
                  if (!confirm('Remove the SLA for this stage?')) return;
                  update('sla', null);
                }}
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ) : (
          <AddButton label="Add SLA" onClick={() => setSlaOpen(true)} />
        )}
      </Section>

      {/* ── Forms ──────────────────────────────────────────────────────── */}
      <Section
        icon={ClipboardList}
        title="Forms"
        color="#7C3AED"
        tint="#F5F3FF"
        action={
          <button
            type="button"
            onClick={() => {
              setFormEditIndex(null);
              setFormBindingOpen(true);
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-gold-700 hover:text-gold-800 hover:bg-gold-50 rounded-md px-1.5 py-1 transition-colors"
          >
            <Plus size={12} />
            Attach
          </button>
        }
      >
        {formBindings.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic">
            No forms attached. Required forms will block transitions until submitted.
          </p>
        ) : (
          <div className="space-y-2">
            {formBindings.map((b, idx) => (
              <div
                key={`${b.formId}-${idx}`}
                className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/60 p-2"
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    b.isRequired ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <FileText size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900 truncate">
                    {b.formTitle
                      ? `${b.formTitle}${b.formVersion ? ` (v${b.formVersion})` : ''}`
                      : `Form ${b.formId.substring(0, 8)}…`}
                  </div>
                  <div className="text-[10.5px] text-gray-500 mt-0.5">
                    {b.isRequired ? 'Required to transition' : 'Optional'}
                    {' · position '}
                    {b.position}
                  </div>
                  <div className="text-[10.5px] text-gray-500 truncate mt-0.5">
                    {`Fill: ${summariseAccess(b.fillRoleLabels, b.fillUserLabels)} · ${
                      (b.fillMode ?? 'ANYONE') === 'EACH' ? 'Each one' : 'Anyone'
                    } · View: ${summariseAccess(b.viewRoleLabels, b.viewUserLabels, 'Fillers only')}`}
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    aria-label="edit form binding"
                    onClick={() => {
                      setFormEditIndex(idx);
                      setFormBindingOpen(true);
                    }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="remove form binding"
                    onClick={() => {
                      if (!confirm('Detach this form from the stage?')) return;
                      update(
                        'formBindings',
                        formBindings.filter((_, i) => i !== idx),
                      );
                    }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

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
        workflowSiteId={workflowSiteId}
        editIndex={formEditIndex}
        onSave={(b, editIndex) =>
          update(
            'formBindings',
            editIndex == null
              ? [...formBindings, b]
              : formBindings.map((existing, i) => (i === editIndex ? b : existing)),
          )
        }
      />

      {approvalEditFor && (
        <ApprovalPolicyEditor
          isOpen={!!approvalEditFor}
          onClose={() => setApprovalEditFor(null)}
          workflowId={workflowId}
          workflowSiteId={workflowSiteId}
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
