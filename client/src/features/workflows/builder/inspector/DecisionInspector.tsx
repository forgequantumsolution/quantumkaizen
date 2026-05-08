import { Input } from '@/components/ui';
import type { DecisionNodeData } from '../builder.types';

interface Props {
  data: DecisionNodeData;
  onChange: (next: DecisionNodeData) => void;
}

export default function DecisionInspector({ data, onChange }: Props) {
  const update = <K extends keyof DecisionNodeData>(key: K, value: DecisionNodeData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Label</label>
        <Input
          value={data.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder="Decision"
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
          Conditions on the outgoing edges decide which branch fires (XOR).
        </p>
      </div>
    </div>
  );
}
