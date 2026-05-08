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

export interface StageNodeData {
  label: string;
  is_initial_stage?: boolean;
  email_notification?: boolean;
  primary_actions?: NodeAction[];
  secondary_actions?: NodeAction[];
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
