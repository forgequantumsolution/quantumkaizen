import { Input, Select } from '@/components/ui';
import type { ForkNodeData, WorkflowFlowNode } from '../builder.types';

interface Props {
  data: ForkNodeData;
  onChange: (next: ForkNodeData) => void;
  allNodes: WorkflowFlowNode[];
}

export default function ForkInspector({ data, onChange, allNodes }: Props) {
  const update = <K extends keyof ForkNodeData>(key: K, value: ForkNodeData[K]) =>
    onChange({ ...data, [key]: value });

  const joinNodes = allNodes.filter((n) => n.type === 'join');

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Label</label>
        <Input
          value={data.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder="Fork"
          maxLength={100}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Branch count</label>
        <Input
          type="number"
          min={2}
          max={8}
          value={data.branchCount}
          onChange={(e) =>
            update('branchCount', Math.max(2, Math.min(8, Number(e.target.value) || 2)))
          }
        />
        <p className="text-xs text-gray-500 mt-1">
          Number of parallel branches activated by this fork (2-8).
        </p>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Split mode</label>
        <Select
          value={data.splitType}
          onChange={(e) => update('splitType', e.target.value as ForkNodeData['splitType'])}
          options={[
            { value: 'AND', label: 'AND — all branches activate' },
            { value: 'OR', label: 'OR — all activate, any can complete' },
            { value: 'XOR', label: 'XOR — only one branch (by condition)' },
          ]}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Joins at</label>
        <Select
          value={data.joinStageId ?? ''}
          onChange={(e) => update('joinStageId', e.target.value || null)}
          options={[
            { value: '', label: '— Select a join node —' },
            ...joinNodes.map((n) => ({
              value: n.id,
              label: (n.data as { label: string }).label || n.id,
            })),
          ]}
        />
        <p className="text-xs text-gray-500 mt-1">
          The join node where these branches converge.
        </p>
      </div>
    </div>
  );
}
