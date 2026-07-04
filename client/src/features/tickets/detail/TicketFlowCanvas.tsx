import { useCallback, useMemo } from 'react';
import { Workflow as WorkflowIcon, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui';
import { useWorkflow } from '@/lib/api/workflow';
import { deserializeFlow } from '@/features/workflows/builder/builder.serializer';
import { layoutGraph } from '@/features/workflows/builder/layout';
import JsPlumbCanvas from '@/features/workflows/builder/JsPlumbCanvas';
import type { StageNodeData } from '@/features/workflows/builder/builder.types';

export interface SelectedStageInfo {
  canonicalId: string;
  persistedId?: string;
  name: string;
  isCurrent: boolean;
  isInitial: boolean;
}

interface Props {
  workflowId: string;
  /** Stage canonical IDs the ticket is currently parked on. */
  currentStageIds?: string[];
  /** Stage persisted IDs (UUIDs) — used as a fallback match. */
  currentPersistedStageIds?: string[];
  /** When true, every stage in the graph renders in its "completed" colour. */
  isCompleted?: boolean;
  height?: number;
  interactive?: boolean;
  /** Layout direction: 'LR' horizontal (default), 'TB' top-to-bottom. */
  direction?: 'LR' | 'TB';
  /** Fired when the user clicks a stage node. Non-stage nodes are ignored. */
  onStageNodeClick?: (info: SelectedStageInfo) => void;
  /** Fired when the user clicks empty canvas — useful for clearing selection. */
  onPaneClick?: () => void;
}

export default function TicketFlowCanvas({
  workflowId,
  currentStageIds = [],
  currentPersistedStageIds = [],
  isCompleted = false,
  height = 420,
  interactive = true,
  direction = 'LR',
  onStageNodeClick,
  onPaneClick,
}: Props) {
  const { data, isLoading, error } = useWorkflow(workflowId);

  const flowJson = useMemo(
    () => data?.flow_json ?? { nodes: [], edges: [] },
    [data],
  );

  const currentIdSet = useMemo(() => new Set(currentStageIds), [currentStageIds]);
  const currentPersistedSet = useMemo(
    () => new Set(currentPersistedStageIds),
    [currentPersistedStageIds],
  );

  // Deserialise + decorate + lay out. Highlight current stage(s): match by
  // canonical id first, then fall back to `persistedStageId` so this works for
  // both pre- and post-publish workflows.
  const { nodes, edges } = useMemo(() => {
    const { nodes: rawNodes, edges: rawEdges } = deserializeFlow(
      flowJson.nodes,
      flowJson.edges,
    );
    const decorated = rawNodes.map((n) => {
      if (n.type !== 'stage') return n;
      const d = n.data as StageNodeData;
      const isCurrent =
        currentIdSet.has(n.id) ||
        (d.persistedStageId ? currentPersistedSet.has(d.persistedStageId) : false);
      return {
        ...n,
        data: {
          ...d,
          isCurrent: isCompleted ? false : isCurrent,
          isCompleted,
          flowDirection: direction,
        },
      };
    });
    return {
      nodes: layoutGraph(decorated, rawEdges, { direction }),
      edges: rawEdges,
    };
  }, [flowJson, currentIdSet, currentPersistedSet, isCompleted, direction]);

  const handleSelect = useCallback(
    (id: string) => {
      if (!onStageNodeClick) return;
      const node = nodes.find((n) => n.id === id);
      if (!node || node.type !== 'stage') return;
      const d = node.data as StageNodeData;
      onStageNodeClick({
        canonicalId: node.id,
        persistedId: d.persistedStageId,
        name: d.label || 'Untitled stage',
        isCurrent: d.isCurrent === true,
        isInitial: d.is_initial_stage === true,
      });
    },
    [nodes, onStageNodeClick],
  );

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
      <JsPlumbCanvas
        nodes={nodes}
        edges={edges}
        interactive={interactive}
        editable={false}
        direction={direction}
        onSelect={handleSelect}
        onPaneClick={onPaneClick}
      />
    </Card>
  );
}
