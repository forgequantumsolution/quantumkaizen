import { useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Workflow as WorkflowIcon, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui';
import { useWorkflow } from '@/lib/api/workflow';
import { deserializeFlow } from '@/features/workflows/builder/builder.serializer';
import { layoutGraph } from '@/features/workflows/builder/layout';
import { nodeTypes } from '@/features/workflows/builder/nodes';
import type { StageNodeData } from '@/features/workflows/builder/builder.types';

interface Props {
  workflowId: string;
  /** Stage canonical IDs the ticket is currently parked on. */
  currentStageIds?: string[];
  /** Stage persisted IDs (UUIDs) — used as a fallback match. */
  currentPersistedStageIds?: string[];
  height?: number;
  interactive?: boolean;
  /** Layout direction: 'LR' horizontal (default), 'TB' top-to-bottom. */
  direction?: 'LR' | 'TB';
}

export default function TicketFlowCanvas({
  workflowId,
  currentStageIds = [],
  currentPersistedStageIds = [],
  height = 420,
  interactive = true,
  direction = 'LR',
}: Props) {
  const { data, isLoading, error } = useWorkflow(workflowId);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const needsFitView = useRef(false);

  const flowJson = useMemo(
    () => data?.flow_json ?? { nodes: [], edges: [] },
    [data],
  );

  const currentIdSet = useMemo(
    () => new Set(currentStageIds),
    [currentStageIds],
  );
  const currentPersistedSet = useMemo(
    () => new Set(currentPersistedStageIds),
    [currentPersistedStageIds],
  );

  useEffect(() => {
    const { nodes: rawNodes, edges: rawEdges } = deserializeFlow(
      flowJson.nodes,
      flowJson.edges,
    );

    // Highlight current stage(s). We try canonical id (the React Flow node id
    // at build time) first, then fall back to `persistedStageId` so this works
    // for both pre- and post-publish workflows.
    const decorated = rawNodes.map((n) => {
      if (n.type !== 'stage') return n;
      const data = n.data as StageNodeData;
      const isCurrent =
        currentIdSet.has(n.id) ||
        (data.persistedStageId
          ? currentPersistedSet.has(data.persistedStageId)
          : false);
      return { ...n, data: { ...data, isCurrent, flowDirection: direction } };
    });

    const laidOut = layoutGraph(decorated, rawEdges, { direction });
    setNodes(laidOut);
    setEdges(rawEdges);
    needsFitView.current = true;
  }, [flowJson, currentIdSet, currentPersistedSet, direction, setNodes, setEdges]);

  useEffect(() => {
    if (!needsFitView.current || nodes.length === 0) return;
    const id = requestAnimationFrame(() => {
      rfRef.current?.fitView({ padding: 0.18, maxZoom: 1, minZoom: 0.4 });
      needsFitView.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [nodes]);

  if (isLoading) {
    return (
      <Card noPadding style={{ height }} className="overflow-hidden">
        <div className="flex items-center justify-center h-full text-gray-400 gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs">Loading workflow…</span>
        </div>
      </Card>
    );
  }

  if (error || !data || flowJson.nodes.length === 0) {
    const reason = error
      ? "Couldn't load this workflow."
      : !data
        ? 'Workflow not found.'
        : 'This workflow has no stages published yet — open the builder to design and save its graph.';
    return (
      <Card noPadding style={{ height }} className="overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 px-6 text-center">
          <WorkflowIcon size={28} className="text-gray-300" />
          <span className="text-sm font-medium text-gray-700">No workflow graph</span>
          <span className="text-xs text-gray-500 max-w-xs">{reason}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card noPadding style={{ height }} className="overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(inst) => {
          rfRef.current = inst;
        }}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={interactive}
        panOnDrag={interactive}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        zoomOnDoubleClick={interactive}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#94A3B8', strokeWidth: 2 },
        }}
      >
        <Background gap={16} size={1} color="#E8ECF2" />
        {interactive && <Controls showInteractive={false} />}
        {interactive && height >= 360 && <MiniMap pannable zoomable />}
      </ReactFlow>
    </Card>
  );
}
