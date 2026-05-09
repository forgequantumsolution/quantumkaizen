import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
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
import {
  isWorkflowValidationFailure,
  useSaveLayout,
  useSaveWorkflow,
  useWorkflow,
} from '@/lib/api/workflow';
import { useStageStatuses } from '@/lib/api/workflowLookups';
import { deserializeFlow, serializeFlow } from './builder.serializer';
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
  const { data: stageStatuses = [] } = useStageStatuses();
  const saveWorkflow = useSaveWorkflow(id);
  const saveLayout = useSaveLayout(id);

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowReactFlowEdge['data']>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  // Load workflow → canvas
  useEffect(() => {
    if (!data) return;
    const { nodes: n, edges: e } = deserializeFlow(data.flow_json.nodes, data.flow_json.edges);
    setNodes(n);
    setEdges(e);
  }, [data, setNodes, setEdges]);

  // Layout autosave: debounced position-only save
  useEffect(() => {
    if (!data || nodes.length === 0) return;
    const timer = setTimeout(() => {
      const positions = nodes.map((n) => ({
        canonicalId: n.id,
        position: n.position,
      }));
      saveLayout.mutate({ positions });
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.map((n) => `${n.id}:${n.position.x},${n.position.y}`).join('|')]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...params, data: { branchName: undefined, condition: undefined } },
          eds as Edge[],
        ) as typeof eds,
      );
    },
    [setEdges],
  );

  const handleAddNode = (kind: NodeKind) => {
    const id = newNodeId();
    // Place new node below the lowest existing node, so vertical flows stack naturally.
    // Gap = approx node height (~90px) + comfortable breathing room.
    const NODE_GAP = 140;
    const baseX = 250;
    const baseY = 100;
    const lowest = nodes.reduce<number | null>(
      (acc, n) => (acc === null ? n.position.y : Math.max(acc, n.position.y)),
      null,
    );
    const y = lowest === null ? baseY : lowest + NODE_GAP;
    const newNode: WorkflowReactFlowNode = {
      id,
      type: kind,
      position: { x: baseX, y },
      data: defaultDataFor(kind),
    };
    setNodes((ns) => [...ns, newNode]);
    setSelectedId(id);
    // Pan the canvas so the new node is visible immediately. Defer a frame so
    // ReactFlow has had a chance to commit the new node before we ask it to focus.
    requestAnimationFrame(() => {
      const inst = rfInstance.current;
      if (!inst) return;
      // Approximate node center: stage cards are ~110×45 in their default state.
      const targetX = baseX + 110;
      const targetY = y + 45;
      const zoom = Math.max(inst.getZoom(), 0.85);
      inst.setCenter(targetX, targetY, { duration: 350, zoom });
    });
  };

  const handleNodeUpdate = (nodeId: string, newData: WorkflowNodeData) => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: newData } : n)));
  };

  const handleNodeDelete = (nodeId: string) => {
    if (!confirm('Delete this node and its connections?')) return;
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedId(null);
  };

  const handleSave = async () => {
    setValidationErrors([]);
    const payload = serializeFlow(
      nodes as WorkflowReactFlowNode[],
      edges as WorkflowReactFlowEdge[],
    );
    try {
      await saveWorkflow.mutateAsync({ flow_json: payload });
      toast.success('Workflow saved');
    } catch (err) {
      if (isWorkflowValidationFailure(err)) {
        setValidationErrors(err.response.data.validation_errors);
        toast.error(`${err.response.data.validation_errors.length} validation error(s)`);
      } else {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message ?? 'Failed to save';
        toast.error(msg);
      }
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
            onClick={() => navigate(`/workflows/${id}`)}
          >
            <ArrowLeft size={14} />
            <span className="ml-1">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">
              {data.workflow.name}
            </h1>
            <p className="text-xs text-gray-500 truncate">Workflow builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {nodes.length} node{nodes.length === 1 ? '' : 's'} · {edges.length} edge
            {edges.length === 1 ? '' : 's'}
          </span>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={saveWorkflow.isPending}
            disabled={saveWorkflow.isPending}
          >
            <Save size={16} />
            <span className="ml-1.5">Save</span>
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
