import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Input as AntInput,
  Modal as AntModal,
  Form as AntForm,
  Switch as AntSwitch,
  Tree,
  Spin,
  type TreeDataNode,
} from 'antd';
import {
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Info,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Lock,
  Star,
  Layers,
  MousePointerClick,
} from 'lucide-react';
import { Card, Button } from '@/components/ui';
import {
  useNavGroups,
  useSaveNavGroups,
  useDeleteNavGroup,
  navGroupKeys,
  maxUpdatedAt,
  type NavGroup,
} from '@/lib/api/navGroups';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';
import {
  STATIC_MODULE_KEYS,
  STATIC_MODULE_LABELS,
  isDocReviewName,
  isWfModuleKey,
  wfDisplayName,
  wfModuleKey,
  workflowTypeIdFromKey,
  type StaticModuleKey,
} from '@/config/navModules';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useHasPermission } from '@/stores/authStore';

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

/** Editable working copy — mirrors the save payload, not the API row. */
interface DraftGroup {
  /** Server id; absent for a group added locally and not yet saved. */
  id?: string;
  key: string;
  title: string;
  collapsible: boolean;
  defaultOpen: boolean;
  isFallback: boolean;
  isSystem: boolean;
  moduleKeys: string[];
}

const UNASSIGNED = '__unassigned__';
const EMPTY_LEAF = '__empty__';

const toDraft = (groups: NavGroup[]): DraftGroup[] =>
  [...groups]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      id: g.id,
      key: g.key,
      title: g.title,
      collapsible: g.collapsible,
      defaultOpen: g.defaultOpen,
      isFallback: g.isFallback,
      isSystem: g.isSystem,
      moduleKeys: [...g.members].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.moduleKey),
    }));

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export default function NavGroupsTab() {
  const { data: groups, isLoading, isError, error } = useNavGroups();
  const { data: workflowTypes } = useWorkflowTypes();
  const save = useSaveNavGroups();
  const remove = useDeleteNavGroup();
  const confirmDelete = useConfirmDelete();
  const canManage = useHasPermission('nav.groups.manage');

  const [draft, setDraft] = useState<DraftGroup[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form] = AntForm.useForm<{ title: string }>();

  // Reload the working copy whenever the server state changes and the admin has
  // no unsaved edits — never clobber in-progress work with a background refetch.
  useEffect(() => {
    if (groups && !dirty) setDraft(toDraft(groups));
  }, [groups, dirty]);

  // Land on the first editable group so the settings panel isn't empty on open.
  useEffect(() => {
    if (!selected && draft.length) {
      setSelected(draft.find((g) => !g.isSystem)?.key ?? draft[0]!.key);
    }
  }, [draft, selected]);

  // Expansion is controlled, not `defaultExpandAll`: on the first paint `draft`
  // is still empty, so the uncontrolled default would latch onto an empty tree
  // and every group would render collapsed once the data arrived. Keyed on the
  // set of group keys so adding/removing a group re-expands, while dragging a
  // module around leaves the user's own collapse state alone.
  const groupKeySignature = draft.map((g) => g.key).join('|');
  useEffect(() => {
    setExpanded([...draft.map((g) => `group:${g.key}`), `group:${UNASSIGNED}`]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKeySignature]);

  /**
   * Every assignable module, INDEPENDENT of what the current admin can see.
   * Building this from the user's own gated sidebar would mean an admin without
   * (say) LIMS access silently drops LIMS from everyone's layout on save.
   */
  const moduleLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const key of STATIC_MODULE_KEYS) {
      map.set(key, STATIC_MODULE_LABELS[key as StaticModuleKey]);
    }
    for (const t of workflowTypes ?? []) {
      // Document Review is a tab inside /dms, never a sidebar module.
      if (t.isDeleted || isDocReviewName(t.name)) continue;
      // Display name, not the internal key — the admin should arrange the same
      // labels that appear in the sidebar.
      map.set(wfModuleKey(t.id), wfDisplayName(t.name));
    }
    return map;
  }, [workflowTypes]);

  const assigned = useMemo(() => new Set(draft.flatMap((g) => g.moduleKeys)), [draft]);
  const unassigned = useMemo(
    () => [...moduleLabels.keys()].filter((k) => !assigned.has(k)),
    [moduleLabels, assigned],
  );

  const labelFor = (moduleKey: string) => {
    const known = moduleLabels.get(moduleKey);
    if (known) return known;
    // A `wf:` row whose type was deleted — shown so the admin can see why a
    // module vanished. The server prunes these on the next save.
    return isWfModuleKey(moduleKey)
      ? `Deleted workflow type ${workflowTypeIdFromKey(moduleKey).slice(0, 8)}…`
      : moduleKey;
  };

  const selectedGroup = draft.find((g) => g.key === selected) ?? null;
  const selectedIndex = draft.findIndex((g) => g.key === selected);
  const fallbackTitle = draft.find((g) => g.isFallback)?.title ?? 'the fallback group';

  // ── Tree ───────────────────────────────────────────────────────────────────
  const moduleNode = (moduleKey: string): TreeDataNode => {
    const orphan = !moduleLabels.has(moduleKey);
    return {
      key: `module:${moduleKey}`,
      isLeaf: true,
      selectable: false,
      title: (
        <span className="group/mod flex items-center gap-2">
          <GripVertical
            size={13}
            className="text-gray-400 group-hover/mod:text-gray-600 shrink-0"
          />
          <span className={orphan ? 'text-gray-500 italic' : 'text-gray-800'}>
            {labelFor(moduleKey)}
          </span>
          {isWfModuleKey(moduleKey) && !orphan && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              workflow
            </span>
          )}
        </span>
      ),
    };
  };

  // An empty group renders this placeholder as its only child, and the
  // placeholder IS the drop target — so it must NOT be `disabled`. rc-tree binds
  // its drag handlers only to enabled nodes, so marking it disabled made every
  // newly added group impossible to fill. It stays unselectable, and
  // `nodeDraggable` already refuses to drag it since the key isn't a `module:`.
  const emptyNode = (groupKey: string): TreeDataNode => ({
    key: `${EMPTY_LEAF}:${groupKey}`,
    isLeaf: true,
    selectable: false,
    title: <span className="text-xs text-gray-500 italic">Drag a module here</span>,
  });

  const treeData: TreeDataNode[] = useMemo(() => {
    const groupNodes: TreeDataNode[] = draft.map((g) => ({
      key: `group:${g.key}`,
      title: (
        <span className="flex items-center gap-2">
          <Layers size={13} className="text-gray-500 shrink-0" />
          <span className="font-semibold text-gray-900">
            {g.title || <span className="text-gray-500 italic font-normal">No header</span>}
          </span>
          {g.isFallback && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-100 ring-1 ring-amber-300 rounded px-1.5 py-px">
              <Star size={9} /> Fallback
            </span>
          )}
          {g.isSystem && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-700 bg-gray-100 ring-1 ring-gray-300 rounded px-1.5 py-px">
              <Lock size={9} /> Locked
            </span>
          )}
          <span className="text-xs text-gray-600">
            {g.moduleKeys.length} {g.moduleKeys.length === 1 ? 'module' : 'modules'}
          </span>
        </span>
      ),
      children: g.moduleKeys.length ? g.moduleKeys.map(moduleNode) : [emptyNode(g.key)],
    }));

    return [
      ...groupNodes,
      {
        key: `group:${UNASSIGNED}`,
        selectable: false,
        title: (
          <span className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Unassigned</span>
            <span className="text-xs text-gray-600">
              {unassigned.length
                ? `${unassigned.length} — will appear under “${fallbackTitle}”`
                : 'empty'}
            </span>
          </span>
        ),
        children: unassigned.length ? unassigned.map(moduleNode) : [emptyNode(UNASSIGNED)],
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, unassigned, moduleLabels, fallbackTitle]);

  /** Which group currently owns a module key (UNASSIGNED if none). */
  const ownerOf = (moduleKey: string) =>
    draft.find((g) => g.moduleKeys.includes(moduleKey))?.key ?? UNASSIGNED;

  const onDrop: React.ComponentProps<typeof Tree>['onDrop'] = (info) => {
    const dragKey = String(info.dragNode.key);
    const dropKey = String(info.node.key);

    // ── Dragging a group reorders it ────────────────────────────────────────
    // Group rows have to be draggable at all (see `nodeDraggable`), so this is
    // the natural meaning rather than leaving the drag as a dead no-op.
    if (dragKey.startsWith('group:')) {
      const from = dragKey.slice('group:'.length);
      const fromGroup = draft.find((g) => g.key === from);
      // The Unassigned bucket is a pseudo-group, and the system row stays pinned.
      if (!fromGroup || fromGroup.isSystem) return;

      const toKey = dropKey.startsWith('group:')
        ? dropKey.slice('group:'.length)
        : dropKey.startsWith(`${EMPTY_LEAF}:`)
          ? dropKey.slice(`${EMPTY_LEAF}:`.length)
          : ownerOf(dropKey.slice('module:'.length));
      if (toKey === from || toKey === UNASSIGNED) return;

      setDraft((prev) => {
        const fromIdx = prev.findIndex((g) => g.key === from);
        const toIdx = prev.findIndex((g) => g.key === toKey);
        if (fromIdx < 0 || toIdx < 0) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        // Never above the pinned system row.
        const floor = next.findIndex((g) => !g.isSystem);
        next.splice(Math.max(toIdx, floor < 0 ? 0 : floor), 0, moved!);
        return next;
      });
      setDirty(true);
      return;
    }

    if (!dragKey.startsWith('module:')) return; // the empty placeholder
    const moduleKey = dragKey.slice('module:'.length);

    let targetGroup: string;
    let targetIndex: number;

    if (dropKey.startsWith('group:')) {
      targetGroup = dropKey.slice('group:'.length);
      targetIndex = info.dropToGap ? 0 : Number.MAX_SAFE_INTEGER;
    } else if (dropKey.startsWith(`${EMPTY_LEAF}:`)) {
      // The "Drag a module here" placeholder stands in for its empty group.
      targetGroup = dropKey.slice(`${EMPTY_LEAF}:`.length);
      targetIndex = 0;
    } else {
      const overKey = dropKey.slice('module:'.length);
      const owner = ownerOf(overKey);
      targetGroup = owner;
      const list =
        owner === UNASSIGNED ? unassigned : draft.find((g) => g.key === owner)!.moduleKeys;
      targetIndex = list.indexOf(overKey) + (info.dropPosition > 0 ? 1 : 0);
    }

    setDraft((prev) => {
      const next = prev.map((g) => ({
        ...g,
        moduleKeys: g.moduleKeys.filter((k) => k !== moduleKey),
      }));
      if (targetGroup === UNASSIGNED) return next; // dropping here just unassigns
      const target = next.find((g) => g.key === targetGroup);
      if (!target) return prev;
      const idx = Math.min(Math.max(targetIndex, 0), target.moduleKeys.length);
      target.moduleKeys.splice(idx, 0, moduleKey);
      return next;
    });
    setDirty(true);
  };

  // ── Group operations ───────────────────────────────────────────────────────
  const moveGroup = (key: string, delta: number) => {
    setDraft((prev) => {
      const i = prev.findIndex((g) => g.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    setDirty(true);
  };

  const patchGroup = (key: string, patch: Partial<DraftGroup>) => {
    setDraft((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));
    setDirty(true);
  };

  const setFallback = (key: string) => {
    setDraft((prev) => prev.map((g) => ({ ...g, isFallback: g.key === key })));
    setDirty(true);
  };

  const addGroup = async () => {
    const values = await form.validateFields();
    const key = slugify(values.title);
    if (!key) return toast.error('Enter a group name');
    if (draft.some((g) => g.key === key)) return toast.error('A group with that name already exists');
    setDraft((prev) => [
      ...prev,
      {
        key,
        title: values.title,
        collapsible: true,
        defaultOpen: false,
        isFallback: false,
        isSystem: false,
        moduleKeys: [],
      },
    ]);
    setDirty(true);
    setSelected(key);
    setAddOpen(false);
    form.resetFields();
  };

  /**
   * Applies the same outcome to the working copy that the server applies to the
   * table: the group goes, and its modules land in the fallback group. Keeping
   * the two in step matters because a later Save sends the whole document — a
   * draft that disagreed would undo the reassignment.
   */
  const dropGroupFromDraft = (g: DraftGroup) =>
    setDraft((prev) =>
      // Pure w.r.t. `prev` — StrictMode runs updaters twice in dev, so mutating
      // the fallback object in place would append the modules twice.
      prev
        .filter((x) => x.key !== g.key)
        .map((x) =>
          x.isFallback && g.moduleKeys.length
            ? { ...x, moduleKeys: [...x.moduleKeys, ...g.moduleKeys] }
            : x,
        ),
    );

  const removeGroup = (g: DraftGroup) => {
    confirmDelete({
      entityLabel: 'navigation group',
      name: g.title || g.key,
      extraWarning:
        g.moduleKeys.length > 0
          ? `Its ${g.moduleKeys.length} module${g.moduleKeys.length === 1 ? '' : 's'} will move to “${fallbackTitle}”. No one's access changes.`
          : "No one's access changes.",
      mutate: async () => {
        // A group that was only added locally has nothing on the server yet.
        // Everything else is deleted for real here rather than queued behind
        // Save: a confirm dialog reads as a durable action, and it was
        // previously possible to "delete" a group, reload, and find it back.
        if (g.id) await remove.mutateAsync(g.id);
        dropGroupFromDraft(g);
        setSelected(null);
      },
      invalidateKey: navGroupKeys.all,
      successMessage: 'Navigation group deleted',
    });
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!draft.some((g) => g.isFallback)) {
      return toast.error('Pick a fallback group — unassigned modules need somewhere to land');
    }
    try {
      await save.mutateAsync({
        baseUpdatedAt: groups ? maxUpdatedAt(groups) : null,
        groups: draft.map((g) => ({
          key: g.key,
          title: g.title,
          collapsible: g.collapsible,
          defaultOpen: g.defaultOpen,
          isFallback: g.isFallback,
          moduleKeys: g.moduleKeys,
        })),
      });
      setDirty(false);
      toast.success('Navigation groups saved');
    } catch (err) {
      toast.error(extractApiError(err));
    }
  };

  const onReset = () => {
    if (groups) setDraft(toDraft(groups));
    setDirty(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }
  if (isError) {
    return (
      <Card>
        <p className="text-sm text-red-600">
          {extractApiError(error, 'Failed to load navigation groups')}
        </p>
      </Card>
    );
  }

  const totalModules = draft.reduce((n, g) => n + g.moduleKeys.length, 0);

  return (
    <div className="space-y-3">
      {/* Grouping vs access is the single most likely misreading of this screen,
          so it is stated up front rather than buried in a tooltip. */}
      <div className="flex gap-2.5 rounded-lg bg-blue-50 ring-1 ring-blue-200 px-3.5 py-2.5">
        <Info size={15} className="text-blue-600 shrink-0 mt-px" />
        <p className="text-xs leading-relaxed text-blue-900">
          <span className="font-semibold">Layout only — this grants no access.</span> A module
          still appears only for people who have permission for it, so a group whose modules are
          all restricted is hidden entirely. Manage who sees what under{' '}
          <strong>Access Control</strong>. Changes apply to everyone the next time they load the
          app.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-xs text-gray-600">
          <span className="font-semibold text-gray-800">{draft.length}</span> groups ·{' '}
          <span className="font-semibold text-gray-800">{totalModules}</span> modules placed
          {unassigned.length > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-amber-700">{unassigned.length}</span> unassigned
            </>
          )}
        </p>
        {dirty && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={!dirty}>
            <RotateCcw size={14} />
            <span className="ml-1.5">Reset</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} disabled={!canManage}>
            <Plus size={14} />
            <span className="ml-1.5">Add group</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={save.isPending}
            onClick={onSave}
            disabled={!canManage || !dirty}
          >
            <Save size={14} />
            <span className="ml-1.5">Save</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-3 items-start">
        {/* ── Layout tree ── */}
        <Card noPadding className="overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Sidebar layout</h3>
            <p className="text-xs text-gray-600">Drag a module onto another group to move it</p>
          </div>
          {/* antd's stock rhythm — a 24px content wrapper plus 4px of node
              padding per row — makes this tree read about twice as tall as the
              sidebar it describes. Tightened here rather than globally so no
              other Tree in the app shifts. `!` because antd v5 injects its
              CSS-in-JS after the stylesheet and would otherwise win on order. */}
          <div
            className="p-2
              [&_.ant-tree-treenode]:!h-[26px]
              [&_.ant-tree-treenode]:!items-center
              [&_.ant-tree-treenode]:!p-0
              [&_.ant-tree-treenode]:!mb-0
              [&_.ant-tree-node-content-wrapper]:!min-h-[24px]
              [&_.ant-tree-node-content-wrapper]:!leading-[24px]
              [&_.ant-tree-switcher]:!h-[24px]
              [&_.ant-tree-switcher]:!leading-[24px]
              [&_.ant-tree-draggable-icon]:!h-[24px]
              [&_.ant-tree-draggable-icon]:!leading-[24px]
              [&_.ant-tree-indent-unit]:!w-3"
          >
            <Tree
              treeData={treeData}
              // Every node must pass `nodeDraggable`, because rc-tree binds its
              // DROP handlers only to draggable nodes — anything excluded here
              // silently stops being a drop target as well. Restricting it to
              // `module:` keys is what made a newly added (empty) group
              // impossible to fill: it has no module children to drop onto, and
              // both its own row and its "Drag a module here" placeholder were
              // refusing the drop. `onDrop` decides what each drag means —
              // modules move between groups, group rows reorder, and a dragged
              // placeholder is ignored.
              draggable={canManage ? { icon: false, nodeDraggable: () => true } : false}
              blockNode
              expandedKeys={expanded}
              onExpand={(keys) => setExpanded(keys.map(String))}
              selectedKeys={selected ? [`group:${selected}`] : []}
              onSelect={(keys) => {
                const k = keys[0] ? String(keys[0]) : '';
                if (k.startsWith('group:')) setSelected(k.slice('group:'.length));
              }}
              onDrop={onDrop}
            />
          </div>
        </Card>

        {/* ── Selected group's settings ──
            Sticky so it stays beside the tree instead of stranding the column in
            whitespace once the layout runs long. */}
        <Card noPadding className="overflow-hidden lg:sticky lg:top-4">
          <div className="px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              {selectedGroup ? selectedGroup.title || 'No header' : 'Group settings'}
            </h3>
          </div>

          {!selectedGroup ? (
            <div className="flex flex-col items-center text-center px-5 py-10">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-2.5">
                <MousePointerClick size={18} className="text-gray-500" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-gray-800">Select a group</p>
              <p className="text-xs text-gray-600 mt-1">
                Pick a group on the left to rename it, set how it opens, or remove it.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1">Group name</label>
                <AntInput
                  data-testid={`nav-group-title-${selectedGroup.key}`}
                  value={selectedGroup.title}
                  placeholder="No header"
                  disabled={!canManage || selectedGroup.isSystem}
                  onChange={(e) => patchGroup(selectedGroup.key, { title: e.target.value })}
                />
                <p className="text-xs text-gray-600 mt-1">
                  {selectedGroup.isSystem
                    ? 'Part of the app shell — cannot be renamed or removed.'
                    : 'Leave empty to render its modules with no header.'}
                </p>
              </div>

              <div className="space-y-2.5 pt-2.5 border-t border-gray-200">
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <span>
                    <span className="block text-xs font-semibold text-gray-800">Collapsible</span>
                    <span className="block text-xs text-gray-600">
                      Show a chevron so the group can be folded away.
                    </span>
                  </span>
                  <AntSwitch
                    size="small"
                    checked={selectedGroup.collapsible}
                    disabled={!canManage || selectedGroup.isSystem}
                    onChange={(v) => patchGroup(selectedGroup.key, { collapsible: v })}
                  />
                </label>

                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <span>
                    <span className="block text-xs font-semibold text-gray-800">
                      Open by default
                    </span>
                    <span className="block text-xs text-gray-600">
                      Starting state for everyone. Each person’s own choice wins afterwards.
                    </span>
                  </span>
                  <AntSwitch
                    size="small"
                    checked={selectedGroup.defaultOpen}
                    // Meaningless on a non-collapsible group — it can never be
                    // shut, so "open by default" has nothing to decide. Left
                    // enabled it read as a working toggle that did nothing.
                    disabled={!canManage || !selectedGroup.collapsible}
                    onChange={(v) => patchGroup(selectedGroup.key, { defaultOpen: v })}
                  />
                </label>
              </div>

              <div className="pt-2.5 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-800">Fallback group</p>
                <p className="text-xs text-gray-600 mt-0.5 mb-2">
                  Modules that aren’t placed anywhere — a new workflow type, or one left over from
                  a deleted group — appear here instead of disappearing.
                </p>
                {selectedGroup.isFallback ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100 ring-1 ring-amber-300 rounded-md px-2 py-1">
                    <Star size={12} /> This is the fallback group
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canManage}
                    onClick={() => setFallback(selectedGroup.key)}
                  >
                    <Star size={13} />
                    <span className="ml-1.5">Make this the fallback</span>
                  </Button>
                )}
              </div>

              <div className="pt-2.5 border-t border-gray-200 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage || selectedIndex <= 0}
                  onClick={() => moveGroup(selectedGroup.key, -1)}
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage || selectedIndex === draft.length - 1}
                  onClick={() => moveGroup(selectedGroup.key, 1)}
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="ml-auto"
                  // The ungrouped system row and the fallback group must always
                  // exist, so neither can be removed.
                  disabled={!canManage || selectedGroup.isSystem || selectedGroup.isFallback}
                  onClick={() => removeGroup(selectedGroup)}
                  title={
                    selectedGroup.isFallback
                      ? 'The fallback group cannot be deleted'
                      : selectedGroup.isSystem
                        ? 'This group cannot be deleted'
                        : 'Delete group'
                  }
                >
                  <Trash2 size={13} />
                  <span className="ml-1.5">Delete</span>
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <AntModal
        title="Add navigation group"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={addGroup}
        okText="Add"
        centered
        width={420}
      >
        <AntForm form={form} layout="vertical" className="pt-2">
          <AntForm.Item
            name="title"
            label="Group name"
            rules={[{ required: true, message: 'Enter a group name' }]}
          >
            <AntInput placeholder="e.g. Quality System" autoFocus />
          </AntForm.Item>
        </AntForm>
      </AntModal>
    </div>
  );
}
