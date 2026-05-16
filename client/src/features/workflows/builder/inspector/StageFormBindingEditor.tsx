/**
 * Canvas-state form binding editor.
 *
 * Picks one form via antd Select (backend-searchable form list) and calls
 * `onAdd` with the new binding. The parent updates `node.data.formBindings`
 * via `onChange`. No POST happens here — the binding materialises as a
 * `StageFormBinding` row on Publish.
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Select as AntSelect, Spin } from 'antd';
import { Button, Input, Modal } from '@/components/ui';
import type { EmbeddedFormBinding } from '../builder.types';
import { useForms } from '@/features/forms/hooks';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stageName: string;
  existing: EmbeddedFormBinding[];
  onAdd: (binding: EmbeddedFormBinding) => void;
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
  stageName,
  existing,
  onAdd,
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
  const excludedIds = new Set(existing.map((b) => b.formId));
  const allForms = ((data?.forms ?? []) as unknown as FormListItem[]).filter(
    (f) => !excludedIds.has(f.id),
  );

  useEffect(() => {
    if (!isOpen) return;
    setFormId(null);
    setIsRequired(true);
    setPosition(String(existing.length));
    setSearch('');
  }, [isOpen, existing.length]);

  const handleAdd = () => {
    if (!formId) {
      toast.error('Pick a form to attach');
      return;
    }
    const positionNum = Number(position);
    if (!Number.isFinite(positionNum) || positionNum < 0) {
      toast.error('Position must be a non-negative integer');
      return;
    }
    onAdd({ formId, isRequired, position: positionNum });
    toast.success('Form attached');
    onClose();
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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            Attach
          </Button>
        </div>
      </div>
    </Modal>
  );
}
