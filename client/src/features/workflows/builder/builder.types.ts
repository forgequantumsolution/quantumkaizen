import type {
  BuilderActionPayload,
  JoinType,
  SplitType,
  StageActionBehavior,
} from '@/lib/api/workflow';

export interface NodeAction {
  id?: string;
  stage_status_id: string;
  stage_status_name?: string;
  behavior?: StageActionBehavior;
  type?: 'primary' | 'secondary';
  action_criteria_id?: string | null;
  roles_id?: string[];
  employees_id?: string[];
}

// ─── Phase 3.5+ — policy intents embedded in the canvas state ────────────
// These live on a stage node so the inspector can edit them on a draft
// (pre-publish) workflow without round-tripping to the policy CRUD endpoints.
// The backend materialises them into real ApprovalPolicy / SlaPolicy /
// StageFormBinding rows on Publish — see workflow.builder.ts.

export type FormFillMode = 'ANYONE' | 'EACH';

/** Lightweight {id,name} pair denormalised onto a binding for display. */
export interface FormAccessRef {
  id: string;
  name: string;
}

export interface EmbeddedFormBinding {
  formId: string;
  isRequired: boolean;
  position: number;
  // Denormalised so the inspector can render "{title} (v{n})" without a
  // separate lookup. Populated by the backend (toFlowJson) on load, and by
  // the picker (StageFormBindingEditor) on attach. Optional only for
  // backwards-compat with canvas state saved before this field existed.
  formTitle?: string;
  formVersion?: number;

  // ── Per-form access control ──────────────────────────────────────────────
  // ANYONE → one shared copy; EACH → one copy per person in the fill group.
  // Defaults to 'ANYONE'. Optional for back-compat with canvas state saved
  // before access control existed (treated as legacy-open by the engine).
  fillMode?: FormFillMode;
  // Who may FILL. The builder UI requires ≥1 fill role for new/edited
  // bindings; an empty fill group on an OLD binding means "legacy open".
  fillRoleIds?: string[];
  fillUserIds?: string[];
  // Who may VIEW only (see the form + responses, never fill).
  viewRoleIds?: string[];
  viewUserIds?: string[];
  // Denormalised labels so the inspector can render names without a lookup,
  // mirroring formTitle. Populated by the picker on attach and toFlowJson on
  // load. Never persisted to the DB (stripped at materialisation).
  fillRoleLabels?: FormAccessRef[];
  fillUserLabels?: FormAccessRef[];
  viewRoleLabels?: FormAccessRef[];
  viewUserLabels?: FormAccessRef[];
}

export interface EmbeddedSlaThreshold {
  name: string;
  percentage: number;
  targetStageCanonicalId?: string | null;
}

export interface EmbeddedSla {
  duration: number; // seconds
  calendarId?: string | null;
  escalationWorkflowId?: string | null;
  pauseOnHold: boolean;
  pauseOnExtensionPending: boolean;
  thresholds: EmbeddedSlaThreshold[];
}

export interface EmbeddedApprovalPolicy {
  actionType: 'primary' | 'secondary';
  actionIndex: number;
  mode: 'SINGLE' | 'ALL_REQUIRED' | 'QUORUM' | 'SEQUENTIAL' | 'ANY';
  requiredCount: number;
  strictRoleMatch: boolean;
  allowSelfApproval: boolean;
  requireUniqueApprovers: boolean;
  approverRoleIds: string[];
  approverUserIds: string[];
  approvalSlaHours?: number | null;
  isActive: boolean;
  /** Loose-typed because canvas passes through whatever the server emits;
   *  backend Zod schema validates the shape on publish. */
  approvalSequence?: unknown;
}

/** Phase 6 — a child-workflow trigger on a stage: "from this stage, raise a
 *  child ticket of workflow X". `childWorkflowName` is display-only (hydrated by
 *  the backend round-trip); only the id is materialised on publish. */
export interface EmbeddedChildTrigger {
  childWorkflowId: string;
  childWorkflowName?: string;
  triggerMode?: 'MANUAL' | 'AUTO';
  isBlocking: boolean;
  allowMultiple: boolean;
  order?: number;
}

export interface StageNodeData {
  label: string;
  is_initial_stage?: boolean;
  email_notification?: boolean;
  primary_actions?: NodeAction[];
  secondary_actions?: NodeAction[];
  /** WorkflowStage UUID — present on stages already persisted to the backend. */
  persistedStageId?: string;
  /** Phase 3.5+ embedded policy intents (canvas-native, materialised on publish). */
  formBindings?: EmbeddedFormBinding[];
  sla?: EmbeddedSla | null;
  approvalPolicies?: EmbeddedApprovalPolicy[];
  /** Phase 6 — allowed child-workflow triggers raiseable from this stage. */
  childTriggers?: EmbeddedChildTrigger[];
  /** Set by TicketFlowCanvas when this stage is one of the ticket's current stages. */
  isCurrent?: boolean;
  /** Set by TicketFlowCanvas when this stage was completed by the ticket. */
  isCompleted?: boolean;
  /** Set by TicketFlowCanvas when the ticket was rejected while parked on this stage. */
  isRejected?: boolean;
  /** Direction of the surrounding flow — controls handle placement. Defaults to 'TB'. */
  flowDirection?: 'TB' | 'LR';
}

export interface ForkNodeData {
  label: string;
  branchCount: number;
  splitType: SplitType;
  joinStageId?: string | null;
}

export interface JoinNodeData {
  label: string;
  branchCount: number;
  joinType: JoinType;
}

export interface DecisionNodeData {
  label: string;
  branchCount: number;
  conditions?: string[];
}

export type WorkflowNodeData = StageNodeData | ForkNodeData | JoinNodeData | DecisionNodeData;

// ─── Framework-agnostic graph model ──────────────────────────────────────────
// Replaces React Flow's Node/Edge shapes. The jsPlumb canvas
// (`JsPlumbCanvas.tsx`) renders these directly; positions are computed by dagre
// (`layout.ts`) and owned by jsPlumb at runtime.
export interface FlowNode<TData = WorkflowNodeData> {
  id: string;
  /** Node kind — selects which renderer + endpoints to use. */
  type: NodeKind;
  position: { x: number; y: number };
  data: TData;
  selected?: boolean;
}

export interface FlowEdgeData {
  branchName?: string;
  condition?: string;
  order?: number;
}

export interface FlowEdge<TData = FlowEdgeData> {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  data?: TData;
}

export type WorkflowFlowNode = FlowNode<WorkflowNodeData>;
export type WorkflowFlowEdge = FlowEdge<FlowEdgeData>;

export const NODE_TYPE_LABELS = {
  stage: 'Stage',
  fork: 'Fork (parallel split)',
  join: 'Join (merge branches)',
  decision: 'Decision (conditional)',
} as const;

export type NodeKind = keyof typeof NODE_TYPE_LABELS;

export const isStageData = (
  d: WorkflowNodeData,
  kind: string,
): d is StageNodeData => kind === 'stage';
export const isForkData = (d: WorkflowNodeData, kind: string): d is ForkNodeData =>
  kind === 'fork';
export const isJoinData = (d: WorkflowNodeData, kind: string): d is JoinNodeData =>
  kind === 'join';
export const isDecisionData = (d: WorkflowNodeData, kind: string): d is DecisionNodeData =>
  kind === 'decision';

// Reused by serializer to coerce shapes for backend
export const toBuilderAction = (a: NodeAction, kind: 'primary' | 'secondary'): BuilderActionPayload => ({
  stage_status_id: a.stage_status_id,
  type: kind,
  action_criteria_id: a.action_criteria_id ?? null,
  roles_id: a.roles_id ?? [],
  employees_id: a.employees_id ?? [],
});
