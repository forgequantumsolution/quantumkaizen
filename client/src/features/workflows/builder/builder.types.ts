import type { Node, Edge } from 'reactflow';
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

export interface EmbeddedFormBinding {
  formId: string;
  isRequired: boolean;
  position: number;
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
  /** Set by TicketFlowCanvas when this stage is one of the ticket's current stages. */
  isCurrent?: boolean;
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

export type WorkflowReactFlowNode = Node<WorkflowNodeData>;
export type WorkflowReactFlowEdge = Edge<{ branchName?: string; condition?: string; order?: number }>;

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
