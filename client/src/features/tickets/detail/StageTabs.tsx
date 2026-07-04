import { useEffect, useMemo, useState } from 'react';
import { Check, CircleDot, Circle, Flag, Loader2, Workflow as WorkflowIcon } from 'lucide-react';
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
    <Card noPadding className="overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Workflow stages
        </span>
        <Legend />
      </div>

      <div
        role="tablist"
        aria-label="Workflow stages"
        className="flex items-stretch px-3 py-3"
      >
        {stages.map((s, i) => (
          <StageTabButton
            key={s.canonicalId}
            stage={s}
            index={i}
            total={stages.length}
            isActive={activeId === s.canonicalId}
            onSelect={() => handleSelect(s)}
          />
        ))}
      </div>
    </Card>
  );
}

interface TabButtonProps {
  stage: StageTab;
  index: number;
  total: number;
  isActive: boolean;
  onSelect: () => void;
}

function StageTabButton({ stage, index, total, isActive, onSelect }: TabButtonProps) {
  const { status } = stage;

  const palette =
    status === 'current'
      ? 'border-[#C9A84C] bg-[#FBF6E7] text-[#5C4A0F]'
      : status === 'done'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-gray-200 bg-white text-gray-600';

  const ring = isActive ? 'ring-2 ring-offset-1 ring-[#C9A84C]' : '';

  const badge =
    status === 'done' ? (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check size={12} strokeWidth={3} />
      </span>
    ) : status === 'current' ? (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C9A84C] text-white">
        <CircleDot size={12} />
      </span>
    ) : (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-semibold text-gray-500">
        {index + 1}
      </span>
    );

  return (
    <div className="flex min-w-0 flex-1 items-center">
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={onSelect}
        title={stage.name}
        className={`group flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all hover:shadow-sm ${palette} ${ring}`}
      >
        {badge}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-sm font-semibold">{stage.name}</span>
            {stage.isInitial && (
              <Flag size={11} className="shrink-0 text-slate-400" aria-label="Initial stage" />
            )}
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-wide opacity-70">
            {status === 'current' ? 'Current' : status === 'done' ? 'Completed' : 'Upcoming'}
          </span>
        </span>
      </button>

      {index < total - 1 && (
        <span
          aria-hidden
          className={`mx-1.5 h-0.5 min-w-[1rem] flex-1 rounded-full ${
            status === 'done' ? 'bg-emerald-300' : 'bg-gray-200'
          }`}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-slate-400">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Done
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-[#C9A84C]" /> Current
      </span>
      <span className="inline-flex items-center gap-1">
        <Circle size={8} className="text-gray-300" /> Upcoming
      </span>
    </div>
  );
}
