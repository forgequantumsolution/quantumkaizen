import { Input, Select } from '@/components/ui';
import type { JoinNodeData } from '../builder.types';

interface Props {
  data: JoinNodeData;
  onChange: (next: JoinNodeData) => void;
}

export default function JoinInspector({ data, onChange }: Props) {
  const update = <K extends keyof JoinNodeData>(key: K, value: JoinNodeData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Label</label>
        <Input
          value={data.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder="Join"
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
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Join mode</label>
        <Select
          value={data.joinType}
          onChange={(e) => update('joinType', e.target.value as JoinNodeData['joinType'])}
          options={[
            { value: 'AND', label: 'AND — all branches must complete' },
            { value: 'OR', label: 'OR — any branch completes the join' },
          ]}
        />
      </div>
    </div>
  );
}
