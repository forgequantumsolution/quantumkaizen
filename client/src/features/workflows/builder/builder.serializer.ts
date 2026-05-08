import type { BuilderEdge, BuilderNode } from '@/lib/api/workflow';
import type {
  WorkflowReactFlowNode,
  WorkflowReactFlowEdge,
  StageNodeData,
  ForkNodeData,
  JoinNodeData,
  DecisionNodeData,
} from './builder.types';

const DEFAULT_POS = { x: 0, y: 0 };

/**
 * Convert backend `flow_json` payload to React Flow nodes/edges.
 */
export const deserializeFlow = (
  serverNodes: BuilderNode[],
  serverEdges: BuilderEdge[],
): { nodes: WorkflowReactFlowNode[]; edges: WorkflowReactFlowEdge[] } => {
  const nodes: WorkflowReactFlowNode[] = serverNodes.map((n) => {
    const kind = (n.data.nodeType ?? n.type ?? 'stage').toLowerCase();
    const position = n.position ?? DEFAULT_POS;
    if (kind === 'fork') {
      const cfg = n.data.parallelConfig ?? {};
      const data: ForkNodeData = {
        label: n.data.label,
        branchCount: cfg.branchCount ?? 2,
        splitType: cfg.splitType ?? 'AND',
        joinStageId: cfg.joinStageId ?? null,
      };
      return { id: n.id, type: 'fork', position, data };
    }
    if (kind === 'join') {
      const cfg = n.data.parallelConfig ?? {};
      const data: JoinNodeData = {
        label: n.data.label,
        branchCount: cfg.branchCount ?? 2,
        joinType: cfg.joinType ?? 'AND',
      };
      return { id: n.id, type: 'join', position, data };
    }
    if (kind === 'decision') {
      const cfg = n.data.parallelConfig ?? {};
      const data: DecisionNodeData = {
        label: n.data.label,
        branchCount: cfg.branchCount ?? 2,
      };
      return { id: n.id, type: 'decision', position, data };
    }
    const data: StageNodeData = {
      label: n.data.label,
      is_initial_stage: n.data.basic_details?.is_initial_stage ?? false,
      email_notification: n.data.basic_details?.email_notification ?? false,
      primary_actions: n.data.primary_actions ?? [],
      secondary_actions: n.data.secondary_actions ?? [],
    };
    return { id: n.id, type: 'stage', position, data };
  });

  const edges: WorkflowReactFlowEdge[] = serverEdges.map((e, idx) => ({
    id: e.id ?? `edge-${idx}`,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    label: e.branchInfo?.branchName ?? e.label,
    data: {
      branchName: e.branchInfo?.branchName,
      condition: e.branchInfo?.condition,
      order: e.branchInfo?.order,
    },
  }));

  return { nodes, edges };
};

/**
 * Convert React Flow state to backend `flow_json` payload.
 */
export const serializeFlow = (
  nodes: WorkflowReactFlowNode[],
  edges: WorkflowReactFlowEdge[],
): { nodes: BuilderNode[]; edges: BuilderEdge[] } => {
  const out: BuilderNode[] = nodes.map((n) => {
    const kind = n.type ?? 'stage';
    if (kind === 'fork') {
      const d = n.data as ForkNodeData;
      return {
        id: n.id,
        type: 'fork',
        position: n.position,
        data: {
          label: d.label,
          nodeType: 'fork',
          parallelConfig: {
            branchCount: d.branchCount,
            splitType: d.splitType,
            joinStageId: d.joinStageId ?? null,
          },
        },
      };
    }
    if (kind === 'join') {
      const d = n.data as JoinNodeData;
      return {
        id: n.id,
        type: 'join',
        position: n.position,
        data: {
          label: d.label,
          nodeType: 'join',
          parallelConfig: {
            branchCount: d.branchCount,
            joinType: d.joinType,
          },
        },
      };
    }
    if (kind === 'decision') {
      const d = n.data as DecisionNodeData;
      return {
        id: n.id,
        type: 'decision',
        position: n.position,
        data: {
          label: d.label,
          nodeType: 'decision',
          parallelConfig: { branchCount: d.branchCount },
        },
      };
    }
    const d = n.data as StageNodeData;
    return {
      id: n.id,
      type: 'stage',
      position: n.position,
      data: {
        label: d.label,
        nodeType: 'stage',
        basic_details: {
          is_initial_stage: d.is_initial_stage ?? false,
          email_notification: d.email_notification ?? false,
        },
        primary_actions: (d.primary_actions ?? []).map((a) => ({
          stage_status_id: a.stage_status_id,
          type: 'primary' as const,
          action_criteria_id: a.action_criteria_id ?? null,
          roles_id: a.roles_id ?? [],
          employees_id: a.employees_id ?? [],
        })),
        secondary_actions: (d.secondary_actions ?? []).map((a) => ({
          stage_status_id: a.stage_status_id,
          type: 'secondary' as const,
          action_criteria_id: a.action_criteria_id ?? null,
          roles_id: a.roles_id ?? [],
          employees_id: a.employees_id ?? [],
        })),
      },
    };
  });

  const outEdges: BuilderEdge[] = edges.map((e, idx) => ({
    source: e.source,
    target: e.target,
    sourceHandle: typeof e.sourceHandle === 'string' ? e.sourceHandle : null,
    targetHandle: typeof e.targetHandle === 'string' ? e.targetHandle : null,
    label: typeof e.label === 'string' ? e.label : undefined,
    branchInfo: {
      branchName: e.data?.branchName,
      condition: e.data?.condition,
      order: e.data?.order ?? idx,
    },
  }));

  return { nodes: out, edges: outEdges };
};
