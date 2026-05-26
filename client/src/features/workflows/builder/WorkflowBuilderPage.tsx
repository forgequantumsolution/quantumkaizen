import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Pause, Play, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { App } from 'antd';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button, Card, Spinner } from '@/components/ui';
import { displayWorkflowName } from '@/lib/utils';
import {
  isWorkflowValidationFailure,
  useDeleteDraft,
  useSaveDraft,
  useSaveWorkflow,
  useSetWorkflowStatus,
  useWorkflow,
  useWorkflowDraft,
} from '@/lib/api/workflow';
import type { BuilderEdge, BuilderNode } from '@/lib/api/workflow';
import { useStageStatuses } from '@/lib/api/workflowLookups';
import { deserializeFlow, serializeFlow } from './builder.serializer';
import { layoutGraph } from './layout';
import { nodeTypes } from './nodes';
import NodePalette from './NodePalette';
import InspectorPanel from './inspector/InspectorPanel';
import ValidationErrorPanel from './ValidationErrorPanel';
import type {
  DecisionNodeData,
  ForkNodeData,
  JoinNodeData,
  NodeKind,
  StageNodeData,
  WorkflowNodeData,
  WorkflowReactFlowEdge,
  WorkflowReactFlowNode,
} from './builder.types';

let nodeCounter = 0;
const newNodeId = () => `node-${Date.now().toString(36)}-${++nodeCounter}`;

const defaultDataFor = (kind: NodeKind): WorkflowNodeData => {
  if (kind === 'fork')
    return { label: 'Fork', branchCount: 2, splitType: 'AND', joinStageId: null } as ForkNodeData;
  if (kind === 'join')
    return { label: 'Join', branchCount: 2, joinType: 'AND' } as JoinNodeData;
  if (kind === 'decision')
    return { label: 'Decision', branchCount: 2 } as DecisionNodeData;
  return {
    label: 'New Stage',
    is_initial_stage: false,
    email_notification: false,
    primary_actions: [],
    secondary_actions: [],
  } as StageNodeData;
};

export default function WorkflowBuilderPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useWorkflow(id);
  const { data: draftData } = useWorkflowDraft(id);
  const { data: stageStatuses = [] } = useStageStatuses();
  const saveDraft = useSaveDraft(id);
  const deleteDraft = useDeleteDraft(id);
  const publish = useSaveWorkflow(id);
  const setStatus = useSetWorkflowStatus(id);
  const { modal } = App.useApp();

  // Has the user ever touched the canvas this session? Used to flip the
  // load preference back to published once they explicitly discard the draft.
  const [draftDiscarded, setDraftDiscarded] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowReactFlowEdge['data']>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const needsFitView = useRef(false);

  // Load workflow → canvas. Prefers the saved draft (TemporaryWorkflow row)
  // over the published flow_json when one exists, so users see exactly what
  // they last saved. Positions are computed by dagre at load time (the backend
  // no longer stores layout). React Flow's `fitView` prop only runs on initial
  // mount BEFORE this effect's setNodes commits, so we set a flag and re-fit
  // in the post-commit effect below.
  useEffect(() => {
    if (!data) return;
    // `draftData?.flow_json` is unknown-typed; cast to the builder shape.
    const draftFlow = draftData?.flow_json as
      | { nodes: BuilderNode[]; edges: BuilderEdge[] }
      | null
      | undefined;
    const source =
      !draftDiscarded && draftFlow && Array.isArray(draftFlow.nodes)
        ? draftFlow
        : data.flow_json;
    const { nodes: n, edges: e } = deserializeFlow(source.nodes, source.edges);
    const laidOut = layoutGraph(n, e, { direction: 'TB' });
    setNodes(laidOut);
    setEdges(e);
    needsFitView.current = true;
  }, [data, draftData, draftDiscarded, setNodes, setEdges]);

  // After the laid-out nodes commit to React state, fit the viewport once so
  // every stage is visible. The flag is single-shot — user-initiated drags
  // don't retrigger this (they go through `onNodesChange` and don't bump
  // `data`, so the load effect above doesn't fire either).
  useEffect(() => {
    if (!needsFitView.current || nodes.length === 0) return;
    const id = requestAnimationFrame(() => {
      rfInstance.current?.fitView({ padding: 0.18, maxZoom: 1, minZoom: 0.4 });
      needsFitView.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [nodes]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  // Apply dagre after a topology change. Drag-only changes go through
  // `onNodesChange` and don't re-layout, so user drags survive within a
  // session.
  const relayout = useCallback(
    (ns: WorkflowReactFlowNode[], es: WorkflowReactFlowEdge[]) =>
      layoutGraph(ns, es as Edge[], { direction: 'TB' }),
    [],
  );

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          { ...params, data: { branchName: undefined, condition: undefined } },
          eds as Edge[],
        ) as typeof eds;
        // After a new edge, re-layout so the graph rearranges to honour the new topology.
        setNodes((cur) => relayout(cur, next as unknown as WorkflowReactFlowEdge[]));
        return next;
      });
    },
    [setEdges, setNodes, relayout],
  );

  const handleAddNode = (kind: NodeKind) => {
    const id = newNodeId();
    const newNode: WorkflowReactFlowNode = {
      id,
      type: kind,
      // Placeholder — dagre lays this out as soon as it's appended.
      position: { x: 0, y: 0 },
      data: defaultDataFor(kind),
    };
    setNodes((ns) => {
      const next = [...ns, newNode];
      return relayout(next, edges as unknown as WorkflowReactFlowEdge[]);
    });
    setSelectedId(id);
    // Pan to the newly added node once dagre has positioned it.
    requestAnimationFrame(() => {
      const inst = rfInstance.current;
      if (!inst) return;
      const placed = (nodes as WorkflowReactFlowNode[]).find((n) => n.id === id);
      if (!placed) {
        inst.fitView({ padding: 0.18, duration: 350 });
        return;
      }
      const zoom = Math.max(inst.getZoom(), 0.85);
      inst.setCenter(placed.position.x + 110, placed.position.y + 45, {
        duration: 350,
        zoom,
      });
    });
  };

  const handleNodeUpdate = (nodeId: string, newData: WorkflowNodeData) => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: newData } : n)));
  };

  const handleNodeDelete = (nodeId: string) => {
    if (!confirm('Delete this node and its connections?')) return;
    const remainingEdges = (edges as WorkflowReactFlowEdge[]).filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );
    setEdges(remainingEdges as typeof edges);
    setNodes((ns) => relayout(ns.filter((n) => n.id !== nodeId), remainingEdges));
    setSelectedId(null);
  };

  /**
   * Save = non-destructive draft. Persists the current canvas JSON into the
   * `TemporaryWorkflow` row WITHOUT touching `WorkflowStage`/`Transition`
   * rows, so attached approval/SLA/form policies survive routine edits.
   */
  const handleSaveDraft = async () => {
    setValidationErrors([]);
    const payload = serializeFlow(
      nodes as WorkflowReactFlowNode[],
      edges as WorkflowReactFlowEdge[],
    );
    try {
      await saveDraft.mutateAsync({ flow_json: payload });
      toast.success('Draft saved');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to save draft';
      toast.error(msg);
    }
  };

  /**
   * Publish = destructive rebuild. Wipes the existing stage graph and
   * rebuilds from the canvas, then flips `workflowStatus` to ACTIVE. Existing
   * approval/SLA/form policies attached to stages on this workflow ARE LOST
   * — that's the pre-existing builder behavior. See WORKFLOW_PHASE_3_5_PLAN
   * §Risks for the planned reconciliation fix.
   */
  const runPublish = async () => {
    setValidationErrors([]);
    const payload = serializeFlow(
      nodes as WorkflowReactFlowNode[],
      edges as WorkflowReactFlowEdge[],
    );
    try {
      const res = await publish.mutateAsync({
        flow_json: payload,
        workflow_settings: { workflowStatus: 'ACTIVE' },
      });
      // Drop the now-stale draft so the next load shows the published graph.
      await deleteDraft.mutateAsync().catch(() => undefined);
      setDraftDiscarded(true);
      // If the save bumped the version, the workflow's id changed — navigate
      // to the new builder URL so subsequent edits target the latest version.
      if (res.meta?.versionBumped && res.workflow.id !== id) {
        toast.success('Workflow published as new version');
        navigate(`/workflows/${res.workflow.id}/builder`, { replace: true });
      } else {
        toast.success('Workflow published');
      }
    } catch (err) {
      if (isWorkflowValidationFailure(err)) {
        setValidationErrors(err.response.data.validation_errors);
        toast.error(`${err.response.data.validation_errors.length} validation error(s)`);
      } else {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message ?? 'Failed to publish';
        toast.error(msg);
      }
    }
  };

  const handlePublish = () => {
    modal.confirm({
      title: 'Publish workflow',
      content:
        'A new version of this workflow will be created and activated. Existing tickets stay on the previous version they were raised against; new tickets will use this version.',
      okText: 'Publish',
      cancelText: 'Cancel',
      centered: true,
      onOk: () => runPublish(),
    });
  };

  const handleSetStatus = async (next: 'ACTIVE' | 'INACTIVE') => {
    try {
      await setStatus.mutateAsync(next);
      toast.success(
        next === 'ACTIVE' ? 'Workflow activated' : 'Workflow deactivated',
      );
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to change status';
      toast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">Workflow not found.</p>
        <Button variant="ghost" onClick={() => navigate('/workflows')} className="mt-3">
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/workflows')}
          >
            <ArrowLeft size={14} />
            <span className="ml-1">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">
              {displayWorkflowName(data.workflow)}
            </h1>
            <p className="text-xs text-gray-500 truncate">Workflow builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {nodes.length} node{nodes.length === 1 ? '' : 's'} · {edges.length} edge
            {edges.length === 1 ? '' : 's'}
          </span>

          {/* Current status pill + flip control. Activate is enabled only
              once at least one stage exists (mirrors the backend guard). */}
          <span
            className={
              data.workflow.workflowStatus === 'ACTIVE'
                ? 'text-[11px] px-2 py-0.5 rounded bg-green-100 text-green-800'
                : data.workflow.workflowStatus === 'INACTIVE'
                  ? 'text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700'
                  : 'text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800'
            }
            title={`Workflow status: ${data.workflow.workflowStatus}`}
          >
            {data.workflow.workflowStatus}
          </span>

          {data.workflow.workflowStatus === 'ACTIVE' ? (
            <Button
              variant="outline"
              onClick={() => handleSetStatus('INACTIVE')}
              isLoading={setStatus.isPending}
              disabled={setStatus.isPending}
              title="Set status to INACTIVE. Doesn't rebuild stages or touch policies."
            >
              <Pause size={16} />
              <span className="ml-1.5">Deactivate</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => handleSetStatus('ACTIVE')}
              isLoading={setStatus.isPending}
              disabled={setStatus.isPending || nodes.length === 0}
              title={
                nodes.length === 0
                  ? 'Add at least one stage before activating'
                  : 'Flip status to ACTIVE. Does NOT rebuild the graph — use Publish for that.'
              }
            >
              <Play size={16} />
              <span className="ml-1.5">Activate</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleSaveDraft}
            isLoading={saveDraft.isPending}
            disabled={saveDraft.isPending}
            title="Save the canvas as a draft. Doesn't rebuild stages or affect policies."
          >
            <Save size={16} />
            <span className="ml-1.5">Save draft</span>
          </Button>
          <Button
            variant="primary"
            onClick={handlePublish}
            isLoading={publish.isPending}
            disabled={publish.isPending || nodes.length === 0}
            title={
              nodes.length === 0
                ? 'Add at least one stage before publishing'
                : 'Rebuild the workflow graph and activate'
            }
          >
            <CheckCircle2 size={16} />
            <span className="ml-1.5">Publish</span>
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 grid gap-2 p-2 overflow-hidden" style={{ gridTemplateColumns: '180px 1fr 296px' }}>
        <div className="h-full min-h-0 overflow-auto">
          <NodePalette onAdd={handleAddNode} />
        </div>

        <Card noPadding className="relative overflow-hidden h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={(inst) => {
              rfInstance.current = inst;
            }}
            onNodeClick={(_e, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.18, maxZoom: 1, minZoom: 0.4 }}
            proOptions={{ hideAttribution: true }}
            connectionLineStyle={{ stroke: '#C9A84C', strokeWidth: 2 }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#94A3B8', strokeWidth: 2 },
            }}
          >
            <Background gap={16} size={1} color="#E8ECF2" />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          <ValidationErrorPanel
            errors={validationErrors}
            onDismiss={() => setValidationErrors([])}
          />
        </Card>

        <div className="h-full min-h-0 overflow-auto">
          <InspectorPanel
            workflowId={id}
            selectedNode={selectedNode as Node<WorkflowNodeData> | null}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
            allNodes={nodes}
            stageStatuses={stageStatuses}
          />
        </div>
      </div>
    </div>
  );
}
