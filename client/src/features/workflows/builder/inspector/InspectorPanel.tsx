import type { Node } from 'reactflow';
import { Card } from '@/components/ui';
import StageInspector from './StageInspector';
import ForkInspector from './ForkInspector';
import JoinInspector from './JoinInspector';
import DecisionInspector from './DecisionInspector';
import type {
  DecisionNodeData,
  ForkNodeData,
  JoinNodeData,
  StageNodeData,
  WorkflowNodeData,
} from '../builder.types';
import type { WorkflowStageStatus } from '@/lib/api/workflowLookups';

interface Props {
  selectedNode: Node<WorkflowNodeData> | null;
  onNodeUpdate: (id: string, data: WorkflowNodeData) => void;
  onNodeDelete: (id: string) => void;
  allNodes: Node[];
  stageStatuses: WorkflowStageStatus[];
}

export default function InspectorPanel({
  selectedNode,
  onNodeUpdate,
  onNodeDelete,
  allNodes,
  stageStatuses,
}: Props) {
  if (!selectedNode) {
    return (
      <Card className="!p-4 h-full">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Inspector</h3>
        <p className="text-xs text-gray-500">Select a node to edit its properties.</p>
      </Card>
    );
  }

  const kind = selectedNode.type ?? 'stage';
  const handleChange = (data: WorkflowNodeData) => onNodeUpdate(selectedNode.id, data);

  return (
    <Card className="!p-4 h-full overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {kind.charAt(0).toUpperCase() + kind.slice(1)} settings
        </h3>
        <button
          onClick={() => onNodeDelete(selectedNode.id)}
          className="text-xs text-red-600 hover:text-red-700"
        >
          Delete node
        </button>
      </div>
      {kind === 'stage' && (
        <StageInspector
          data={selectedNode.data as StageNodeData}
          onChange={handleChange}
          stageStatuses={stageStatuses}
        />
      )}
      {kind === 'fork' && (
        <ForkInspector
          data={selectedNode.data as ForkNodeData}
          onChange={handleChange}
          allNodes={allNodes}
        />
      )}
      {kind === 'join' && (
        <JoinInspector data={selectedNode.data as JoinNodeData} onChange={handleChange} />
      )}
      {kind === 'decision' && (
        <DecisionInspector data={selectedNode.data as DecisionNodeData} onChange={handleChange} />
      )}
    </Card>
  );
}
