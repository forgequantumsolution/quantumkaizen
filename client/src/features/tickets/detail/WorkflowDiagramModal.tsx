import { Modal } from '@/components/ui';
import TicketFlowCanvas, { type SelectedStageInfo } from './TicketFlowCanvas';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  workflowLabel: string;
  currentStageIds: string[];
  currentPersistedStageIds: string[];
  selectedStage: SelectedStageInfo | null;
  onSelectStage: (stage: SelectedStageInfo) => void;
  onClearSelectedStage: () => void;
}

export default function WorkflowDiagramModal({
  isOpen,
  onClose,
  workflowId,
  workflowLabel,
  currentStageIds,
  currentPersistedStageIds,
  selectedStage,
  onSelectStage,
  onClearSelectedStage,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={workflowLabel} size="xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#C9A84C]" />
            current stage
          </span>
          {selectedStage && (
            <button
              type="button"
              onClick={onClearSelectedStage}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <TicketFlowCanvas
            workflowId={workflowId}
            currentStageIds={currentStageIds}
            currentPersistedStageIds={currentPersistedStageIds}
            direction="LR"
            height={460}
            onStageNodeClick={onSelectStage}
            onPaneClick={onClearSelectedStage}
          />
        </div>

        {selectedStage && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {selectedStage.isCurrent
                ? 'Current stage'
                : selectedStage.isInitial
                  ? 'Initial stage'
                  : 'Selected stage'}
            </div>
            <div className="mt-0.5 font-medium text-slate-800">{selectedStage.name}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
