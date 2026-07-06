import {
  CircleDot,
  Mail,
  ShieldCheck,
  FileText,
  Timer,
  Zap,
  Users,
  User as UserIcon,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import type {
  WorkflowFlowNode,
  StageNodeData,
  NodeAction,
  EmbeddedFormBinding,
  EmbeddedApprovalPolicy,
  FormAccessRef,
} from './builder/builder.types';

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(' ') || `${seconds}s`;
}

function accessSummary(
  roles?: FormAccessRef[],
  users?: FormAccessRef[],
  emptyLabel = 'Anyone',
): string {
  const names = [...(roles ?? []).map((r) => r.name), ...(users ?? []).map((u) => u.name)];
  return names.length ? names.join(', ') : emptyLabel;
}

const APPROVAL_MODE_LABEL: Record<EmbeddedApprovalPolicy['mode'], string> = {
  SINGLE: 'Single approver',
  ALL_REQUIRED: 'All required',
  QUORUM: 'Quorum',
  SEQUENTIAL: 'Sequential',
  ANY: 'Any one',
};

// ─── Small presentational bits ────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className="text-gray-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </span>
        {typeof count === 'number' && (
          <span className="text-[10px] font-medium text-gray-400">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ActionRow({
  action,
  criteriaName,
}: {
  action: NodeAction;
  criteriaName?: string;
}) {
  const roleCount = action.roles_id?.length ?? 0;
  const userCount = action.employees_id?.length ?? 0;
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-gray-900">
          {action.stage_status_name ?? 'Action'}
        </span>
        {action.behavior && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {action.behavior}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2.5 text-[11px] text-gray-500">
        <span>{criteriaName ?? 'Anyone'}</span>
        {roleCount > 0 && (
          <span className="flex items-center gap-1">
            <Users size={11} /> {roleCount}
          </span>
        )}
        {userCount > 0 && (
          <span className="flex items-center gap-1">
            <UserIcon size={11} /> {userCount}
          </span>
        )}
      </div>
    </div>
  );
}

function FormRow({ binding }: { binding: EmbeddedFormBinding }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-gray-900">
          {binding.formTitle ?? 'Form'}
        </span>
        {typeof binding.formVersion === 'number' && (
          <span className="text-[10px] text-gray-400">v{binding.formVersion}</span>
        )}
        {binding.isRequired ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">
            required
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            optional
          </span>
        )}
        {binding.fillMode && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
            {binding.fillMode === 'EACH' ? 'one per filler' : 'shared copy'}
          </span>
        )}
      </div>
      <div className="mt-1 space-y-0.5 text-[11px] text-gray-500">
        <div>
          <span className="text-gray-400">Fill:</span>{' '}
          {accessSummary(binding.fillRoleLabels, binding.fillUserLabels)}
        </div>
        <div>
          <span className="text-gray-400">View:</span>{' '}
          {accessSummary(binding.viewRoleLabels, binding.viewUserLabels, 'Fillers only')}
        </div>
      </div>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-gray-400 italic">{children}</p>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  node: WorkflowFlowNode;
  /** Resolve an action-criteria id → display name. */
  criteriaName?: (id?: string | null) => string | undefined;
  /** Labels of stages this stage flows into. */
  outgoing?: string[];
  /** Labels of stages that flow into this stage. */
  incoming?: string[];
}

export default function WorkflowStageDetails({
  node,
  criteriaName,
  outgoing = [],
  incoming = [],
}: Props) {
  // Non-stage nodes (fork/join/decision) only carry a label — show a stub.
  if (node.type !== 'stage') {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-900 capitalize">
          {node.data.label || node.type}
        </h3>
        <p className="mt-1 text-xs text-gray-500 capitalize">{node.type} node</p>
      </div>
    );
  }

  const data = node.data as StageNodeData;
  const primary = data.primary_actions ?? [];
  const secondary = data.secondary_actions ?? [];
  const forms = data.formBindings ?? [];
  const policies = data.approvalPolicies ?? [];
  const sla = data.sla ?? null;

  const actionLabel = (p: EmbeddedApprovalPolicy): string => {
    const arr = p.actionType === 'primary' ? primary : secondary;
    return arr[p.actionIndex]?.stage_status_name ?? `${p.actionType} action`;
  };

  const hasActions = primary.length > 0 || secondary.length > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900">{data.label || 'Untitled'}</h3>
          {data.is_initial_stage && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
              <CircleDot size={10} /> initial
            </span>
          )}
          {data.email_notification && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
              <Mail size={10} /> email
            </span>
          )}
        </div>
      </div>

      {/* Actions — always shown so a form-only stage reads as intentional. */}
      <Section icon={Zap} title="Actions" count={hasActions ? primary.length + secondary.length : undefined}>
        {!hasActions && <EmptyLine>No actions on this stage.</EmptyLine>}
        {primary.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Primary</p>
            {primary.map((a, i) => (
              <ActionRow
                key={`p-${i}`}
                action={a}
                criteriaName={criteriaName?.(a.action_criteria_id)}
              />
            ))}
          </div>
        )}
        {secondary.length > 0 && (
          <div className="space-y-1.5 mt-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Secondary</p>
            {secondary.map((a, i) => (
              <ActionRow
                key={`s-${i}`}
                action={a}
                criteriaName={criteriaName?.(a.action_criteria_id)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Forms — always shown. */}
      <Section icon={FileText} title="Attached forms" count={forms.length || undefined}>
        {forms.length === 0 ? (
          <EmptyLine>No forms attached.</EmptyLine>
        ) : (
          <div className="space-y-1.5">
            {[...forms]
              .sort((a, b) => a.position - b.position)
              .map((b, i) => (
                <FormRow key={`f-${i}`} binding={b} />
              ))}
          </div>
        )}
      </Section>

      {sla && (
        <Section icon={Timer} title="SLA">
          <div className="text-xs text-gray-700">
            Duration <span className="font-medium">{formatDuration(sla.duration)}</span>
          </div>
          {sla.thresholds.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sla.thresholds.map((t, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700"
                >
                  {t.name} · {t.percentage}%
                </span>
              ))}
            </div>
          )}
        </Section>
      )}

      {policies.length > 0 && (
        <Section icon={ShieldCheck} title="Approval policies" count={policies.length}>
          <div className="space-y-1.5">
            {policies.map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-gray-900">{actionLabel(p)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
                    {APPROVAL_MODE_LABEL[p.mode]}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2.5 text-[11px] text-gray-500">
                  {(p.mode === 'QUORUM' || p.requiredCount > 1) && (
                    <span>needs {p.requiredCount}</span>
                  )}
                  {p.approverRoleIds.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {p.approverRoleIds.length}
                    </span>
                  )}
                  {p.approverUserIds.length > 0 && (
                    <span className="flex items-center gap-1">
                      <UserIcon size={11} /> {p.approverUserIds.length}
                    </span>
                  )}
                  {typeof p.approvalSlaHours === 'number' && p.approvalSlaHours > 0 && (
                    <span>{p.approvalSlaHours}h SLA</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(incoming.length > 0 || outgoing.length > 0) && (
        <Section icon={GitBranch} title="Flow">
          <div className="space-y-1 text-[11px] text-gray-600">
            {incoming.length > 0 && (
              <div className="flex items-start gap-1.5">
                <ArrowLeft size={12} className="text-gray-400 mt-0.5 shrink-0" />
                <span>
                  <span className="text-gray-400">From:</span> {incoming.join(', ')}
                </span>
              </div>
            )}
            {outgoing.length > 0 && (
              <div className="flex items-start gap-1.5">
                <ArrowRight size={12} className="text-gray-400 mt-0.5 shrink-0" />
                <span>
                  <span className="text-gray-400">To:</span> {outgoing.join(', ')}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
