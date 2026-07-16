/**
 * Canvas-state child-workflow trigger editor (Phase 6).
 *
 * Picks a child workflow to allow raising from this stage, plus two toggles:
 *   - Allow multiple — can more than one child of this workflow be raised here.
 *   - Blocking — (config only for now) marks the child as gating stage completion.
 *
 * Calls `onSave(trigger, editIndex)` — the parent updates `node.data.childTriggers`
 * via `onChange`. No POST happens here; triggers materialise as
 * `ChildWorkflowTrigger` rows on Publish (workflow.builder.buildWorkflowGraph).
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Select as AntSelect, Spin } from 'antd';
import { Button, Modal } from '@/components/ui';
import type { EmbeddedChildTrigger } from '../builder.types';
import { useWorkflowDirectory } from '@/lib/api/workflow';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stageName: string;
  /** The workflow being edited — excluded from the picker (no self-trigger). */
  currentWorkflowId?: string;
  existing: EmbeddedChildTrigger[];
  /** When non-null, edits the trigger at this index (workflow locked). */
  editIndex?: number | null;
  onSave: (trigger: EmbeddedChildTrigger, editIndex?: number | null) => void;
}

export default function ChildTriggerEditor({
  isOpen,
  onClose,
  stageName,
  currentWorkflowId,
  existing,
  editIndex = null,
  onSave,
}: Props) {
  const { data, isLoading } = useWorkflowDirectory();
  const editing = editIndex != null ? existing[editIndex] : null;

  const [childWorkflowId, setChildWorkflowId] = useState<string | undefined>();
  const [childWorkflowName, setChildWorkflowName] = useState<string | undefined>();
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setChildWorkflowId(editing?.childWorkflowId);
    setChildWorkflowName(editing?.childWorkflowName);
    setAllowMultiple(editing?.allowMultiple ?? false);
    setIsBlocking(editing?.isBlocking ?? false);
  }, [isOpen, editIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Workflows already attached to this stage (excluded so you can't add a dup),
  // and the workflow being edited itself (no self-trigger).
  const takenIds = useMemo(() => {
    const s = new Set(
      existing
        .filter((_, i) => i !== editIndex)
        .map((t) => t.childWorkflowId),
    );
    if (currentWorkflowId) s.add(currentWorkflowId);
    return s;
  }, [existing, editIndex, currentWorkflowId]);

  const options = useMemo(
    () =>
      (data?.items ?? [])
        .filter((w) => !takenIds.has(w.id) || w.id === editing?.childWorkflowId)
        .map((w) => ({
          value: w.id,
          label: w.type?.name ? `${w.name} · ${w.type.name}` : w.name,
        })),
    [data, takenIds, editing],
  );

  const submit = () => {
    if (!childWorkflowId) {
      toast.error('Pick a child workflow');
      return;
    }
    onSave(
      {
        childWorkflowId,
        childWorkflowName,
        triggerMode: 'MANUAL',
        allowMultiple,
        isBlocking,
        order: editing?.order,
      },
      editIndex,
    );
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editIndex != null ? 'Edit child ticket' : 'Allow child ticket'}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-[12px] text-gray-500">
          From <span className="font-medium text-gray-700">{stageName}</span>, a user can raise a
          child ticket of the selected workflow. It will nest under the parent.
        </p>

        <div>
          <label className="text-[12px] font-medium text-gray-700 mb-1 block">
            Child workflow <span className="text-red-500">*</span>
          </label>
          {isLoading ? (
            <Spin size="small" />
          ) : (
            <AntSelect
              value={childWorkflowId}
              onChange={(v, opt) => {
                setChildWorkflowId(v);
                const label = Array.isArray(opt) ? undefined : (opt?.label as string | undefined);
                setChildWorkflowName(label?.split(' · ')[0]);
              }}
              disabled={editIndex != null}
              showSearch
              optionFilterProp="label"
              placeholder="Select a workflow to allow"
              options={options}
              className="w-full"
              notFoundContent={options.length === 0 ? 'No other workflows available' : undefined}
            />
          )}
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="text-[13px] font-medium text-gray-800">Allow multiple</span>
            <span className="block text-[11px] text-gray-500">
              Raise more than one child of this workflow from this stage. Off = one only.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isBlocking}
            onChange={(e) => setIsBlocking(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="text-[13px] font-medium text-gray-800">Blocking</span>
            <span className="block text-[11px] text-gray-500">
              Mark the child as gating this stage. (Recorded now; enforcement is a later phase.)
            </span>
          </span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit}>
            {editIndex != null ? 'Save' : 'Add'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
