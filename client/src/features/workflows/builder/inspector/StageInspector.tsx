import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import type { StageNodeData, NodeAction } from '../builder.types';
import type { WorkflowStageStatus } from '@/lib/api/workflowLookups';

interface Props {
  data: StageNodeData;
  onChange: (next: StageNodeData) => void;
  stageStatuses: WorkflowStageStatus[];
}

export default function StageInspector({ data, onChange, stageStatuses }: Props) {
  const update = <K extends keyof StageNodeData>(key: K, value: StageNodeData[K]) =>
    onChange({ ...data, [key]: value });

  const addAction = (kind: 'primary' | 'secondary') => {
    if (stageStatuses.length === 0) return;
    const first = stageStatuses[0]!;
    const newAction: NodeAction = {
      stage_status_id: first.id,
      stage_status_name: first.name,
      behavior: first.behavior,
      type: kind,
      roles_id: [],
      employees_id: [],
    };
    if (kind === 'primary') {
      update('primary_actions', [...(data.primary_actions ?? []), newAction]);
    } else {
      update('secondary_actions', [...(data.secondary_actions ?? []), newAction]);
    }
  };

  const updateAction = (
    kind: 'primary' | 'secondary',
    idx: number,
    patch: Partial<NodeAction>,
  ) => {
    const arr = (kind === 'primary' ? data.primary_actions : data.secondary_actions) ?? [];
    const next = arr.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    if (kind === 'primary') update('primary_actions', next);
    else update('secondary_actions', next);
  };

  const removeAction = (kind: 'primary' | 'secondary', idx: number) => {
    const arr = (kind === 'primary' ? data.primary_actions : data.secondary_actions) ?? [];
    const next = arr.filter((_, i) => i !== idx);
    if (kind === 'primary') update('primary_actions', next);
    else update('secondary_actions', next);
  };

  const renderActions = (kind: 'primary' | 'secondary') => {
    const arr = (kind === 'primary' ? data.primary_actions : data.secondary_actions) ?? [];
    return (
      <div className="space-y-2">
        {arr.length === 0 && (
          <p className="text-xs text-gray-400 italic">No {kind} actions yet.</p>
        )}
        {arr.map((a, i) => {
          const status = stageStatuses.find((s) => s.id === a.stage_status_id);
          return (
            <div key={i} className="flex gap-2 items-start">
              <Select
                value={a.stage_status_id}
                onChange={(e) => {
                  const s = stageStatuses.find((x) => x.id === e.target.value);
                  updateAction(kind, i, {
                    stage_status_id: e.target.value,
                    stage_status_name: s?.name,
                    behavior: s?.behavior,
                  });
                }}
                options={stageStatuses.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.behavior})`,
                }))}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAction(kind, i)}
                aria-label="remove action"
              >
                <Trash2 size={14} className="text-red-500" />
              </Button>
              {status && a.behavior !== status.behavior && (
                <span className="text-[10px] text-amber-600">behavior mismatch</span>
              )}
            </div>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => addAction(kind)}>
          <Plus size={14} />
          <span className="ml-1">Add {kind} action</span>
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">Stage name</label>
        <Input
          value={data.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder="e.g. Review"
          maxLength={100}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!data.is_initial_stage}
          onChange={(e) => update('is_initial_stage', e.target.checked)}
        />
        <span>Initial stage</span>
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!data.email_notification}
          onChange={(e) => update('email_notification', e.target.checked)}
        />
        <span>Send email notification</span>
      </label>

      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Primary actions
        </h4>
        {renderActions('primary')}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Secondary actions
        </h4>
        {renderActions('secondary')}
      </div>
    </div>
  );
}
