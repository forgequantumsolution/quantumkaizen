/**
 * Canvas-state form binding editor (add or edit).
 *
 * Picks one form via antd Select (backend-searchable form list) and configures
 * its per-form access:
 *   - Fill roles (required ≥1) + fill users — who may enter & submit.
 *   - Fill mode — ANYONE (one shared copy) or EACH (one copy per person).
 *   - View-only roles + users — who may see the form but never fill it.
 *
 * Calls `onSave(binding, editIndex)` — the parent updates
 * `node.data.formBindings` via `onChange`. No POST happens here; the binding
 * (and its access lists) materialise as a `StageFormBinding` row on Publish.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Select as AntSelect, Spin } from 'antd';
import { Button, Input, Modal, Select } from '@/components/ui';
import type {
  EmbeddedFormBinding,
  FormAccessRef,
  FormFillMode,
} from '../builder.types';
import { useForms } from '@/features/forms/hooks';
import { useRoleDirectory } from '@/features/admin/roles/hooks';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stageName: string;
  existing: EmbeddedFormBinding[];
  /** The workflow's owning site (null = global). Scopes the form fill/view
   *  role & user pickers to that site (docs/workflow-site-ownership-plan.md). */
  workflowSiteId?: string | null;
  /** When non-null, the editor edits the binding at this index (form locked). */
  editIndex?: number | null;
  onSave: (binding: EmbeddedFormBinding, editIndex?: number | null) => void;
}

interface FormListItem {
  id: string;
  title: string;
  version: number;
  status: string;
}

// ─── Reusable role / user multiselects ─────────────────────────────────────
// Both report resolved id→name labels up so the parent can denormalise them
// onto the binding (mirrors formTitle) for display without a later lookup.

function RoleMultiSelect({
  value,
  onChange,
  onLabels,
  placeholder,
  siteId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  onLabels: (map: Record<string, string>) => void;
  placeholder: string;
  siteId?: string | null;
}) {
  // Site-scoped role directory (workflow-site-ownership Phase D/E). Bounded set →
  // AntSelect filters client-side.
  const { data, isFetching } = useRoleDirectory(siteId || undefined);
  const roles = data?.items ?? [];
  const [cache, setCache] = useState<Record<string, string>>({});

  useEffect(() => {
    if (roles.length === 0) return;
    const map: Record<string, string> = {};
    for (const r of roles) map[r.id] = r.name;
    setCache((prev) => ({ ...prev, ...map }));
    onLabels(map);
  }, [roles]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(
    () => [
      ...roles.map((r) => ({ value: r.id, label: r.name })),
      ...value
        .filter((id) => !roles.some((r) => r.id === id))
        .map((id) => ({ value: id, label: cache[id] ?? id })),
    ],
    [roles, value, cache],
  );

  return (
    <AntSelect
      mode="multiple"
      allowClear
      showSearch
      style={{ width: '100%' }}
      placeholder={placeholder}
      value={value}
      onChange={(vals: string[]) => onChange(vals)}
      optionFilterProp="label"
      notFoundContent={isFetching ? <Spin size="small" /> : <span>No roles match</span>}
      options={options}
      maxTagCount="responsive"
    />
  );
}

function UserMultiSelect({
  value,
  onChange,
  onLabels,
  placeholder,
  siteId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  onLabels: (map: Record<string, string>) => void;
  placeholder: string;
  siteId?: string | null;
}) {
  // Site-scoped people directory (workflow-site-ownership Phase D/E).
  const { data, isFetching } = useUserDirectory(siteId || undefined);
  const users = data?.items ?? [];
  const [cache, setCache] = useState<Record<string, string>>({});

  useEffect(() => {
    if (users.length === 0) return;
    const map: Record<string, string> = {};
    for (const u of users) map[u.id] = `${u.name} (${u.email})`;
    setCache((prev) => ({ ...prev, ...map }));
    onLabels(map);
  }, [users]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(
    () => [
      ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
      ...value
        .filter((id) => !users.some((u) => u.id === id))
        .map((id) => ({ value: id, label: cache[id] ?? id })),
    ],
    [users, value, cache],
  );

  return (
    <AntSelect
      mode="multiple"
      allowClear
      showSearch
      style={{ width: '100%' }}
      placeholder={placeholder}
      value={value}
      onChange={(vals: string[]) => onChange(vals)}
      optionFilterProp="label"
      notFoundContent={isFetching ? <Spin size="small" /> : <span>No users match</span>}
      options={options}
      maxTagCount="responsive"
    />
  );
}

const toRefs = (ids: string[], labels: Record<string, string>): FormAccessRef[] =>
  ids.map((id) => ({ id, name: labels[id] ?? id }));

export default function StageFormBindingEditor({
  isOpen,
  onClose,
  stageName,
  existing,
  workflowSiteId,
  editIndex = null,
  onSave,
}: Props) {
  const isEdit = editIndex != null;
  const editing = isEdit ? existing[editIndex as number] : undefined;

  const [formId, setFormId] = useState<string | null>(null);
  const [isRequired, setIsRequired] = useState(true);
  const [position, setPosition] = useState('0');
  const [fillMode, setFillMode] = useState<FormFillMode>('ANYONE');
  const [fillRoleIds, setFillRoleIds] = useState<string[]>([]);
  const [fillUserIds, setFillUserIds] = useState<string[]>([]);
  const [viewRoleIds, setViewRoleIds] = useState<string[]>([]);
  const [viewUserIds, setViewUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);

  // Shared id→name maps fed by the pickers, used to denormalise labels on save.
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>({});
  const [userLabels, setUserLabels] = useState<Record<string, string>>({});
  const mergeRoleLabels = (m: Record<string, string>) =>
    setRoleLabels((prev) => ({ ...prev, ...m }));
  const mergeUserLabels = (m: Record<string, string>) =>
    setUserLabels((prev) => ({ ...prev, ...m }));

  const { data, isFetching } = useForms({
    search: debouncedSearch || undefined,
    page_size: 50,
  });
  // Exclude already-attached forms, but keep the one being edited selectable.
  const excludedIds = new Set(
    existing.filter((_, i) => i !== editIndex).map((b) => b.formId),
  );
  const allForms = ((data?.forms ?? []) as unknown as FormListItem[]).filter(
    (f) => !excludedIds.has(f.id),
  );

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setFormId(editing.formId);
      setIsRequired(editing.isRequired);
      setPosition(String(editing.position));
      setFillMode(editing.fillMode ?? 'ANYONE');
      setFillRoleIds(editing.fillRoleIds ?? []);
      setFillUserIds(editing.fillUserIds ?? []);
      setViewRoleIds(editing.viewRoleIds ?? []);
      setViewUserIds(editing.viewUserIds ?? []);
      // Seed label maps from the binding's denormalised labels so already-
      // selected items show their names before any search runs.
      const rl: Record<string, string> = {};
      const ul: Record<string, string> = {};
      for (const r of [...(editing.fillRoleLabels ?? []), ...(editing.viewRoleLabels ?? [])])
        rl[r.id] = r.name;
      for (const u of [...(editing.fillUserLabels ?? []), ...(editing.viewUserLabels ?? [])])
        ul[u.id] = u.name;
      setRoleLabels(rl);
      setUserLabels(ul);
    } else {
      setFormId(null);
      setIsRequired(true);
      setPosition(String(existing.length));
      setFillMode('ANYONE');
      setFillRoleIds([]);
      setFillUserIds([]);
      setViewRoleIds([]);
      setViewUserIds([]);
      setRoleLabels({});
      setUserLabels({});
    }
    setSearch('');
  }, [isOpen, editIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    if (!formId) {
      toast.error('Pick a form to attach');
      return;
    }
    const positionNum = Number(position);
    if (!Number.isFinite(positionNum) || positionNum < 0) {
      toast.error('Position must be a non-negative integer');
      return;
    }
    if (fillRoleIds.length === 0) {
      toast.error('Pick at least one role that can fill this form');
      return;
    }
    const picked = allForms.find((f) => f.id === formId);
    const formTitle = picked?.title ?? editing?.formTitle;
    const formVersion = picked?.version ?? editing?.formVersion;
    onSave(
      {
        formId,
        isRequired,
        position: positionNum,
        formTitle,
        formVersion,
        fillMode,
        fillRoleIds,
        fillUserIds,
        viewRoleIds,
        viewUserIds,
        fillRoleLabels: toRefs(fillRoleIds, roleLabels),
        fillUserLabels: toRefs(fillUserIds, userLabels),
        viewRoleLabels: toRefs(viewRoleIds, roleLabels),
        viewUserLabels: toRefs(viewUserIds, userLabels),
      },
      editIndex,
    );
    toast.success(isEdit ? 'Form access updated' : 'Form attached');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${isEdit ? 'Edit form access' : 'Attach form'} — ${stageName}`}
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Form</label>
          <AntSelect
            allowClear
            showSearch
            disabled={isEdit}
            style={{ width: '100%' }}
            placeholder="Search forms by title…"
            value={formId ?? undefined}
            onChange={(v: string | undefined) => setFormId(v ?? null)}
            onSearch={setSearch}
            onBlur={() => setSearch('')}
            filterOption={false}
            notFoundContent={isFetching ? <Spin size="small" /> : <span>No forms match</span>}
            options={
              isEdit && editing
                ? [
                    {
                      value: editing.formId,
                      label: editing.formTitle
                        ? `${editing.formTitle}${editing.formVersion ? ` (v${editing.formVersion})` : ''}`
                        : editing.formId,
                    },
                  ]
                : allForms.map((f) => ({
                    value: f.id,
                    label: `${f.title} (v${f.version})`,
                  }))
            }
          />
          {isEdit && (
            <p className="text-[11px] text-gray-500 mt-1">
              Editing access creates a new workflow version on publish.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Position</label>
            <Input
              type="number"
              min="0"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
            <p className="text-[11px] text-gray-500 mt-1">Lower numbers render first.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Type</label>
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

        {/* ── Fill access ──────────────────────────────────────────────── */}
        <div className="border-t pt-3 space-y-3">
          <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Who can fill
          </h5>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Fill roles <span className="text-red-500">*</span>
            </label>
            <RoleMultiSelect
              value={fillRoleIds}
              onChange={setFillRoleIds}
              onLabels={mergeRoleLabels}
              placeholder="Search roles…"
              siteId={workflowSiteId}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Fill users <span className="text-gray-400">(optional)</span>
            </label>
            <UserMultiSelect
              value={fillUserIds}
              onChange={setFillUserIds}
              onLabels={mergeUserLabels}
              placeholder="Search users by name or email…"
              siteId={workflowSiteId}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Fill mode</label>
            <Select
              value={fillMode}
              onChange={(e) => setFillMode(e.target.value as FormFillMode)}
              options={[
                { value: 'ANYONE', label: 'Anyone — one shared copy' },
                { value: 'EACH', label: 'Each one — a copy per person' },
              ]}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              {fillMode === 'ANYONE'
                ? 'One shared copy. Any of the people above can fill it.'
                : 'A separate copy for each person (every member of the selected roles, plus named users). The stage won’t advance until everyone has submitted.'}
            </p>
          </div>
        </div>

        {/* ── View-only access ─────────────────────────────────────────── */}
        <div className="border-t pt-3 space-y-3">
          <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Who can view only
          </h5>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              View-only roles <span className="text-gray-400">(optional)</span>
            </label>
            <RoleMultiSelect
              value={viewRoleIds}
              onChange={setViewRoleIds}
              onLabels={mergeRoleLabels}
              placeholder="Search roles…"
              siteId={workflowSiteId}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              View-only users <span className="text-gray-400">(optional)</span>
            </label>
            <UserMultiSelect
              value={viewUserIds}
              onChange={setViewUserIds}
              onLabels={mergeUserLabels}
              placeholder="Search users by name or email…"
              siteId={workflowSiteId}
            />
          </div>
          <p className="text-[11px] text-gray-500">
            Can see the form and its responses, but can never fill it. People in neither list
            have no access.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {isEdit ? 'Save' : 'Attach'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
