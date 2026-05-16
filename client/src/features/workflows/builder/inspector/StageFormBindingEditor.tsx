/**
 * Builder-side editor for attaching a `Form` to a stage as a `StageFormBinding`.
 *
 * Single form per modal invocation. Multi-binding is achieved by opening the
 * modal multiple times. Backend search via antd Select, debounced 250ms.
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Select as AntSelect, Spin } from 'antd';
import { Button, Input, Modal } from '@/components/ui';
import {
  useCreateStageFormBinding,
  type CreateStageFormBindingBody,
} from '@/lib/api/stageForm';
import { useForms } from '@/features/forms/hooks';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  stageId: string;
  stageName: string;
  /** Form ids already bound to this stage — hidden from the picker so we
   *  don't surface obviously-invalid options. The backend enforces the
   *  uniqueness constraint anyway. */
  excludeFormIds: string[];
}

interface FormListItem {
  id: string;
  title: string;
  version: number;
  status: string;
}

export default function StageFormBindingEditor({
  isOpen,
  onClose,
  workflowId,
  stageId,
  stageName,
  excludeFormIds,
}: Props) {
  const [formId, setFormId] = useState<string | null>(null);
  const [isRequired, setIsRequired] = useState(true);
  const [position, setPosition] = useState('0');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data, isFetching } = useForms({
    search: debouncedSearch || undefined,
    page_size: 50,
  });
  const allForms = ((data?.forms ?? []) as unknown as FormListItem[]).filter(
    (f) => !excludeFormIds.includes(f.id),
  );

  const create = useCreateStageFormBinding(workflowId);

  useEffect(() => {
    if (!isOpen) return;
    setFormId(null);
    setIsRequired(true);
    setPosition('0');
    setSearch('');
  }, [isOpen]);

  const submit = async () => {
    if (!formId) {
      toast.error('Pick a form to bind');
      return;
    }
    const positionNum = Number(position);
    if (!Number.isFinite(positionNum) || positionNum < 0) {
      toast.error('Position must be a non-negative integer');
      return;
    }
    try {
      const body: CreateStageFormBindingBody = {
        stageId,
        formId,
        isRequired,
        position: positionNum,
      };
      await create.mutateAsync(body);
      toast.success('Form attached to stage');
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? 'Failed to attach form';
      toast.error(msg);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Attach form — ${stageName}`}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Form</label>
          <AntSelect
            allowClear
            showSearch
            style={{ width: '100%' }}
            placeholder="Search forms by title…"
            value={formId ?? undefined}
            onChange={(v: string | undefined) => setFormId(v ?? null)}
            onSearch={setSearch}
            onBlur={() => setSearch('')}
            filterOption={false}
            notFoundContent={
              isFetching ? <Spin size="small" /> : <span>No forms match</span>
            }
            options={allForms.map((f) => ({
              value: f.id,
              label: `${f.title} (v${f.version})`,
            }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Position
            </label>
            <Input
              type="number"
              min="0"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Lower numbers render first.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Type
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer h-9">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
              />
              <span>Required to transition out</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            isLoading={create.isPending}
            disabled={create.isPending}
          >
            Attach
          </Button>
        </div>
      </div>
    </Modal>
  );
}
