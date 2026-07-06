import { useEffect, useMemo, useState } from 'react';
import { Loader2, Workflow as WorkflowIcon } from 'lucide-react';
import { Card } from '@/components/ui';
import { useWorkflow } from '@/lib/api/workflow';
import { deserializeFlow } from '@/features/workflows/builder/builder.serializer';
import { layoutGraph } from '@/features/workflows/builder/layout';
import type { StageNodeData } from '@/features/workflows/builder/builder.types';
import type { SelectedStageInfo } from './TicketFlowCanvas';

type StageStatus = 'done' | 'current' | 'upcoming';

interface StageTab extends SelectedStageInfo {
  order: number;
  status: StageStatus;
}

interface Props {
  workflowId: string;
  /** Stage canonical IDs the ticket is currently parked on. */
  currentStageIds?: string[];
  /** Stage persisted IDs (UUIDs) — used as a fallback match. */
  currentPersistedStageIds?: string[];
  /** When true, every stage renders in its "completed" colour. */
  isCompleted?: boolean;
  /** Canonical id of the tab currently selected by the parent. */
  selectedCanonicalId?: string | null;
  /** Fired when the user clicks a stage tab. */
  onStageSelect?: (info: SelectedStageInfo) => void;
}

export default function StageTabs({
  workflowId,
  currentStageIds = [],
  currentPersistedStageIds = [],
  isCompleted = false,
  selectedCanonicalId = null,
  onStageSelect,
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

  const stages = useMemo<StageTab[]>(() => {
    const { nodes: rawNodes, edges: rawEdges } = deserializeFlow(
      flowJson.nodes,
      flowJson.edges,
    );
    // Lay out left-to-right so node x-positions give us a stable flow order.
    const laidOut = layoutGraph(rawNodes, rawEdges, { direction: 'LR' });

    const stageNodes = laidOut
      .filter((n) => n.type === 'stage')
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);

    const isCurrentOf = (n: (typeof stageNodes)[number]) => {
      const d = n.data as StageNodeData;
      return (
        currentIdSet.has(n.id) ||
        (d.persistedStageId ? currentPersistedSet.has(d.persistedStageId) : false)
      );
    };

    // First current stage in flow order splits "done" from "upcoming".
    const firstCurrentIdx = stageNodes.findIndex(isCurrentOf);

    return stageNodes.map((n, idx) => {
      const d = n.data as StageNodeData;
      const current = isCurrentOf(n);
      let status: StageStatus;
      if (isCompleted) status = 'done';
      else if (current) status = 'current';
      else if (firstCurrentIdx !== -1 && idx < firstCurrentIdx) status = 'done';
      else status = 'upcoming';

      return {
        canonicalId: n.id,
        persistedId: d.persistedStageId,
        name: d.label || 'Untitled stage',
        isCurrent: !isCompleted && current,
        isInitial: d.is_initial_stage === true,
        order: idx,
        status,
      };
    });
  }, [flowJson, currentIdSet, currentPersistedSet, isCompleted]);

  // Default selection follows the current (or last) stage until the user picks.
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  useEffect(() => {
    const fallback =
      stages.find((s) => s.status === 'current')?.canonicalId ??
      stages[stages.length - 1]?.canonicalId ??
      null;
    setInternalSelected(fallback);
  }, [stages]);

  const activeId = selectedCanonicalId ?? internalSelected;

  if (isLoading) {
    return (
      <Card noPadding>
        <div className="flex items-center justify-center gap-2 py-6 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs">Loading stages…</span>
        </div>
      </Card>
    );
  }

  if (error || !data || stages.length === 0) {
    return (
      <Card noPadding>
        <div className="flex flex-col items-center justify-center gap-1.5 py-8 px-6 text-center text-gray-500">
          <WorkflowIcon size={24} className="text-gray-300" />
          <span className="text-sm font-medium text-gray-700">No stages to show</span>
          <span className="text-xs text-gray-500 max-w-xs">
            {error
              ? "Couldn't load this workflow."
              : 'This workflow has no stages published yet.'}
          </span>
        </div>
      </Card>
    );
  }

  const handleSelect = (s: StageTab) => {
    setInternalSelected(s.canonicalId);
    onStageSelect?.({
      canonicalId: s.canonicalId,
      persistedId: s.persistedId,
      name: s.name,
      isCurrent: s.isCurrent,
      isInitial: s.isInitial,
    });
  };

  return (
    <Card>
      <div
        role="tablist"
        aria-label="Workflow stages"
        className="flex items-stretch gap-2"
      >
        {stages.map((s) => (
          <StageStep
            key={s.canonicalId}
            stage={s}
            isActive={activeId === s.canonicalId}
            onSelect={() => handleSelect(s)}
          />
        ))}
      </div>
    </Card>
  );
}

interface StepProps {
  stage: StageTab;
  isActive: boolean;
  onSelect: () => void;
}

function StageStep({ stage, isActive, onSelect }: StepProps) {
  const { status } = stage;

  const bar =
    status === 'done'
      ? 'bg-emerald-500'
      : status === 'current'
        ? 'bg-blue-500'
        : 'bg-gray-200';

  const label =
    status === 'done'
      ? 'text-emerald-600'
      : status === 'current'
        ? 'text-blue-600 font-semibold'
        : 'text-gray-400';

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onSelect}
      title={`${stage.name} — ${
        status === 'current' ? 'Current' : status === 'done' ? 'Completed' : 'Upcoming'
      }`}
      className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-slate-50/70"
    >
      <span className={`h-1.5 w-full rounded-full transition-colors ${bar}`} />
      <span
        className={`max-w-full truncate text-center text-xs transition-colors ${label} ${
          isActive ? 'underline decoration-2 underline-offset-4' : ''
        }`}
      >
        {stage.name}
      </span>
    </button>
  );
}
