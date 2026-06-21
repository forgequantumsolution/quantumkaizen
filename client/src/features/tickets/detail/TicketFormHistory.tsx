/**
 * Stage-scoped read-only view of submitted forms/checklists, driven by the
 * workflow diagram. Clicking a stage in TicketFlowCanvas selects it here and
 * shows that stage's filled forms. Defaults:
 *   - in-progress ticket → nothing here (the CURRENT stage's actionable forms
 *     render above in StageFormSection);
 *   - completed ticket   → the LAST stage that had a submission.
 *
 * Reuses FormFillEmbed in read-only mode — no separate renderer.
 */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import { Card } from '@/components/ui';
import {
  useTicketFormHistory,
  type SubmittedFormHistoryItem,
} from '@/lib/api/stageForm';
import FormFillEmbed from '@/features/forms/FormFillEmbed';

interface Props {
  ticketId: string;
  /** Persisted stage id selected in the flow diagram (null = use default). */
  selectedStageId?: string | null;
  /** Persisted ids of the ticket's current stage(s) — their actionable forms
   *  render above in StageFormSection, so we skip them here. */
  currentStageIds?: string[];
  /** Whether the ticket is completed — drives the default stage. */
  isCompleted: boolean;
}

interface StageGroup {
  stageId: string;
  stageName: string | null;
  items: SubmittedFormHistoryItem[];
}

export default function TicketFormHistory({
  ticketId,
  selectedStageId = null,
  currentStageIds = [],
  isCompleted,
}: Props) {
  const { data } = useTicketFormHistory(ticketId);
  const submissions = useMemo(() => data?.submissions ?? [], [data]);

  // Group by stage (order of first appearance), keeping the latest submission
  // per form within a stage so a re-filled form isn't listed twice.
  const groups = useMemo<StageGroup[]>(() => {
    const byStage = new Map<string, StageGroup>();
    for (const s of submissions) {
      const key = s.stageId ?? '∅';
      let g = byStage.get(key);
      if (!g) {
        g = { stageId: key, stageName: s.stageName, items: [] };
        byStage.set(key, g);
      }
      const existing = g.items.findIndex((i) => i.formId === s.formId);
      if (existing > -1) g.items[existing] = s; // submissions are asc → keep latest
      else g.items.push(s);
    }
    return [...byStage.values()];
  }, [submissions]);

  // The "last stage" = the stage of the most recent submission.
  const lastStageId = submissions.length
    ? submissions[submissions.length - 1]!.stageId
    : null;

  const effectiveStageId =
    selectedStageId ?? (isCompleted ? lastStageId : null);

  const group = effectiveStageId
    ? groups.find((g) => g.stageId === effectiveStageId)
    : undefined;

  // Within the chosen stage, which form is open.
  const [activeFormKey, setActiveFormKey] = useState<string | null>(null);
  useEffect(() => {
    if (!group || group.items.length === 0) {
      setActiveFormKey(null);
      return;
    }
    if (activeFormKey && group.items.some((i) => i.id === activeFormKey)) return;
    setActiveFormKey(group.items[0]!.id);
  }, [group, activeFormKey]);

  if (!effectiveStageId) return null; // in-progress + nothing selected

  // The current stage's forms are shown (actionable) above — don't duplicate.
  if (currentStageIds.includes(effectiveStageId)) return null;

  // A stage was selected (or defaulted) but has no submitted forms.
  if (!group) {
    return (
      <Card className="!py-4">
        <div className="text-xs text-gray-400">
          No submitted forms recorded for this stage.
        </div>
      </Card>
    );
  }

  const active = group.items.find((i) => i.id === activeFormKey) ?? group.items[0]!;
  const multi = group.items.length > 1;

  return (
    <Card noPadding className="overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-gray-100 flex-wrap">
        <FileText size={15} className="text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-800">Stage Forms</h3>
        {group.stageName && (
          <span className="text-[11px] text-gray-500">· {group.stageName}</span>
        )}
        <span className="text-[11px] text-gray-400 ml-auto">
          {group.items.length} submitted form{group.items.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Form selector — only when the stage has more than one form. */}
      {multi && (
        <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveFormKey(item.id)}
              title={item.formTitle}
              className={`inline-flex items-center gap-1.5 max-w-[260px] px-3 py-1.5 rounded-full border text-sm font-medium transition-colors bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 ${
                item.id === active.id ? 'ring-2 ring-emerald-300' : ''
              }`}
            >
              <CheckCircle2 size={12} className="text-emerald-600" />
              <span className="truncate">{item.formTitle}</span>
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-4">
        <div className="mb-3 text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Read-only · {active.formTitle}
          {active.submittedBy?.name && (
            <span className="text-gray-400">· by {active.submittedBy.name}</span>
          )}
          {active.submittedAt && (
            <span className="text-gray-400">
              · {new Date(active.submittedAt).toLocaleString()}
            </span>
          )}
        </div>
        <FormFillEmbed
          key={active.id}
          formId={active.formId}
          submissionId={active.id}
          readOnly
          variant="inline"
        />
      </div>
    </Card>
  );
}
