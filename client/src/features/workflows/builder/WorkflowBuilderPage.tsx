import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Pause,
  Play,
  Save,
  Spline,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { App } from 'antd';
import { Button, Spinner } from '@/components/ui';
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
import JsPlumbCanvas, { type JsPlumbCanvasHandle } from './JsPlumbCanvas';
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
  WorkflowFlowEdge,
  WorkflowFlowNode,
} from './builder.types';
import { isStageData } from './builder.types';

/**
 * Publish-time guard: every action on every stage must carry an approval
 * policy. Returns a human-readable error per action that's missing one.
 */
const collectMissingPolicyErrors = (nodes: WorkflowFlowNode[]): string[] => {
  const errors: string[] = [];
  for (const node of nodes) {
    if (!isStageData(node.data, node.type)) continue;
    const data = node.data;
    const policies = data.approvalPolicies ?? [];
    const stageName = data.label?.trim() || 'Untitled stage';
    const hasPolicy = (type: 'primary' | 'secondary', index: number) =>
      policies.some((p) => p.actionType === type && p.actionIndex === index);
    const check = (type: 'primary' | 'secondary') =>
      (type === 'primary' ? data.primary_actions : data.secondary_actions ?? [])?.forEach(
        (a, i) => {
          if (!hasPolicy(type, i)) {
            errors.push(
              `Stage "${stageName}": ${type} action "${a.stage_status_name ?? 'Action'}" has no approval policy.`,
            );
          }
        },
      );
    check('primary');
    check('secondary');
  }
  return errors;
};

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

  const [nodes, setNodes] = useState<WorkflowFlowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowFlowEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const canvasRef = useRef<JsPlumbCanvasHandle | null>(null);

  // Re-fit the viewport after a full graph (re)load. The canvas auto-fits on
  // first mount; this covers switching between the draft and the published
  // graph. Two rAFs so the node elements are measured after jsPlumb lays them
  // out.
  const scheduleFit = useCallback(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => canvasRef.current?.fitView()),
    );
  }, []);

  // Load workflow → canvas. Prefers the saved draft (TemporaryWorkflow row)
  // over the published flow_json when one exists, so users see exactly what
  // they last saved. Positions are computed by dagre at load time (the backend
  // no longer stores layout).
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
    scheduleFit();
  }, [data, draftData, draftDiscarded, scheduleFit]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  // Apply dagre after a topology change. Position-only changes (drags) update a
  // single node's `position` and don't re-layout, so user drags survive within
  // a session.
  const relayout = useCallback(
    (ns: WorkflowFlowNode[], es: WorkflowFlowEdge[]) =>
      layoutGraph(ns, es, { direction: 'TB' }),
    [],
  );

  const handleConnect = useCallback(
    (source: string, target: string) => {
      setEdges((eds) => {
        if (eds.some((e) => e.source === source && e.target === target)) return eds;
        const next: WorkflowFlowEdge[] = [
          ...eds,
          {
            id: `edge-${source}-${target}-${eds.length}`,
            source,
            target,
            sourceHandle: null,
            targetHandle: null,
            data: {},
          },
        ];
        // After a new edge, re-layout so the graph honours the new topology.
        setNodes((cur) => relayout(cur, next));
        return next;
      });
    },
    [relayout],
  );

  const handleDisconnect = useCallback(
    (source: string, target: string) => {
      setEdges((eds) => {
        const next = eds.filter((e) => !(e.source === source && e.target === target));
        if (next.length === eds.length) return eds;
        setNodes((cur) => relayout(cur, next));
        return next;
      });
    },
    [relayout],
  );

  const handleNodePositionChange = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, position: pos } : n)));
    },
    [],
  );

  const handleAddNode = (kind: NodeKind) => {
    const id = newNodeId();
    const newNode: WorkflowFlowNode = {
      id,
      type: kind,
      // Placeholder — dagre lays this out as soon as it's appended.
      position: { x: 0, y: 0 },
      data: defaultDataFor(kind),
    };
    setNodes((ns) => relayout([...ns, newNode], edges));
    setSelectedId(id);
    // Re-fit once dagre has positioned the new node.
    scheduleFit();
  };

  const handleNodeUpdate = (nodeId: string, newData: WorkflowNodeData) => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: newData } : n)));
  };

  const handleNodeDelete = (nodeId: string) => {
    modal.confirm({
      title: 'Delete node',
      content: 'Delete this node and its connections?',
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: () => {
        const remainingEdges = edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        );
        setEdges(remainingEdges);
        setNodes((ns) => relayout(ns.filter((n) => n.id !== nodeId), remainingEdges));
        setSelectedId(null);
      },
    });
  };

  /**
   * Save = non-destructive draft. Persists the current canvas JSON into the
   * `TemporaryWorkflow` row WITHOUT touching `WorkflowStage`/`Transition`
   * rows, so attached approval/SLA/form policies survive routine edits.
   */
  const handleSaveDraft = async () => {
    setValidationErrors([]);
    const payload = serializeFlow(nodes, edges);
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
    const payload = serializeFlow(nodes, edges);
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
    const missingPolicies = collectMissingPolicyErrors(nodes);
    if (missingPolicies.length > 0) {
      setValidationErrors(missingPolicies);
      toast.error(`${missingPolicies.length} action(s) missing an approval policy`);
      return;
    }
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

  const status = data.workflow.workflowStatus;
  const statusStyle =
    status === 'ACTIVE'
      ? { dot: '#22C55E', text: 'text-green-700', bg: 'bg-green-50', ring: 'ring-green-200' }
      : status === 'INACTIVE'
        ? { dot: '#94A3B8', text: 'text-gray-600', bg: 'bg-gray-50', ring: 'ring-gray-200' }
        : { dot: '#F59E0B', text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-gradient-to-b from-slate-50 to-slate-100/50">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200/70 bg-white/80 backdrop-blur-md shadow-[0_1px_3px_rgba(15,23,42,0.04)] z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/workflows')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
            title="Back to workflows"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <WorkflowIcon size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-gray-900 truncate leading-tight">
              {displayWorkflowName(data.workflow)}
            </h1>
            <p className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">
              Workflow builder
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Graph stats */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-50 ring-1 ring-gray-200/70 text-[11px] font-medium text-gray-600">
            <span className="flex items-center gap-1.5" title="Nodes">
              <Boxes size={13} className="text-gray-400" />
              {nodes.length}
            </span>
            <span className="w-px h-3.5 bg-gray-200" />
            <span className="flex items-center gap-1.5" title="Connections">
              <Spline size={13} className="text-gray-400" />
              {edges.length}
            </span>
          </div>

          {/* Status pill */}
          <span
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ring-1 ${statusStyle.bg} ${statusStyle.text} ${statusStyle.ring}`}
            title={`Workflow status: ${status}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: statusStyle.dot }}
            />
            {status}
          </span>

          <span className="w-px h-6 bg-gray-200 mx-0.5" />

          {status === 'ACTIVE' ? (
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
      <div className="flex-1 grid gap-3 p-3 overflow-hidden" style={{ gridTemplateColumns: '210px 1fr 320px' }}>
        <div className="h-full min-h-0 overflow-hidden">
          <NodePalette onAdd={handleAddNode} />
        </div>

        <div className="relative overflow-hidden h-full rounded-2xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-black/[0.02]">
          <JsPlumbCanvas
            ref={canvasRef}
            nodes={nodes}
            edges={edges}
            selectedId={selectedId}
            interactive
            editable
            direction="TB"
            onConnect={handleConnect}
            onNodePositionChange={handleNodePositionChange}
            onSelect={setSelectedId}
            onPaneClick={() => setSelectedId(null)}
            onNodeDelete={handleNodeDelete}
          />
          <ValidationErrorPanel
            errors={validationErrors}
            onDismiss={() => setValidationErrors([])}
          />
        </div>

        <div className="h-full min-h-0 overflow-hidden">
          <InspectorPanel
            workflowId={id}
            workflowSiteId={data?.workflow.site?.id ?? null}
            selectedNode={selectedNode}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
            allNodes={nodes}
            stageStatuses={stageStatuses}
            edges={edges}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      </div>
    </div>
  );
}
