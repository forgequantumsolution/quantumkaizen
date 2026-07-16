import type { BuilderEdge, BuilderNode } from '@/lib/api/workflow';
import type {
  WorkflowFlowNode,
  WorkflowFlowEdge,
  StageNodeData,
  ForkNodeData,
  JoinNodeData,
  DecisionNodeData,
} from './builder.types';

// Auto-layout (dagre) decides actual positions at render time — see
// `layout.ts`. The canvas still needs a placeholder so the node can mount
// before the layout pass runs.
const DEFAULT_POS = { x: 0, y: 0 };

/**
 * Convert backend `flow_json` payload to canvas nodes/edges.
 */
export const deserializeFlow = (
  serverNodes: BuilderNode[],
  serverEdges: BuilderEdge[],
): { nodes: WorkflowFlowNode[]; edges: WorkflowFlowEdge[] } => {
  const nodes: WorkflowFlowNode[] = serverNodes.map((n) => {
    const kind = (n.data.nodeType ?? n.type ?? 'stage').toLowerCase();
    if (kind === 'fork') {
      const cfg = n.data.parallelConfig ?? {};
      const data: ForkNodeData = {
        label: n.data.label,
        branchCount: cfg.branchCount ?? 2,
        splitType: cfg.splitType ?? 'AND',
        joinStageId: cfg.joinStageId ?? null,
      };
      return { id: n.id, type: 'fork', position: DEFAULT_POS, data };
    }
    if (kind === 'join') {
      const cfg = n.data.parallelConfig ?? {};
      const data: JoinNodeData = {
        label: n.data.label,
        branchCount: cfg.branchCount ?? 2,
        joinType: cfg.joinType ?? 'AND',
      };
      return { id: n.id, type: 'join', position: DEFAULT_POS, data };
    }
    if (kind === 'decision') {
      const cfg = n.data.parallelConfig ?? {};
      const data: DecisionNodeData = {
        label: n.data.label,
        branchCount: cfg.branchCount ?? 2,
      };
      return { id: n.id, type: 'decision', position: DEFAULT_POS, data };
    }
    const data: StageNodeData = {
      label: n.data.label,
      is_initial_stage: n.data.basic_details?.is_initial_stage ?? false,
      email_notification: n.data.basic_details?.email_notification ?? false,
      primary_actions: n.data.primary_actions ?? [],
      secondary_actions: n.data.secondary_actions ?? [],
      persistedStageId: n.data.persistedStageId,
      // Phase 3.5+ embedded policy intents.
      formBindings: n.data.formBindings ?? [],
      sla: n.data.sla ?? null,
      approvalPolicies: n.data.approvalPolicies ?? [],
      // Phase 6 — child-workflow triggers.
      childTriggers: n.data.childTriggers ?? [],
    };
    return { id: n.id, type: 'stage', position: DEFAULT_POS, data };
  });

  const edges: WorkflowFlowEdge[] = serverEdges.map((e, idx) => ({
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
 * Convert canvas state to backend `flow_json` payload. Positions are no
 * longer round-tripped to the server — layout is purely a client concern.
 */
export const serializeFlow = (
  nodes: WorkflowFlowNode[],
  edges: WorkflowFlowEdge[],
): { nodes: BuilderNode[]; edges: BuilderEdge[] } => {
  const out: BuilderNode[] = nodes.map((n) => {
    const kind = n.type ?? 'stage';
    if (kind === 'fork') {
      const d = n.data as ForkNodeData;
      return {
        id: n.id,
        type: 'fork',
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
        // Phase 3.5+ embedded policy intents — passed through verbatim.
        formBindings: d.formBindings ?? [],
        sla: d.sla ?? null,
        approvalPolicies: d.approvalPolicies ?? [],
        // Phase 6 — child-workflow triggers. Strip display-only fields; the
        // backend re-hydrates childWorkflowName on the next load.
        childTriggers: (d.childTriggers ?? []).map((t, idx) => ({
          childWorkflowId: t.childWorkflowId,
          triggerMode: t.triggerMode ?? 'MANUAL',
          isBlocking: t.isBlocking ?? false,
          allowMultiple: t.allowMultiple ?? false,
          order: t.order ?? idx,
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
