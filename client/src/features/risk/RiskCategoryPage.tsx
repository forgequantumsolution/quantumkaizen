/**
 * Risk categories — the taxonomy every risk, hazard-library entry and dashboard
 * roll-up is grouped by. Categories nest one level or many via `parent_id`, so
 * the table is rendered as a flattened tree: parents first, children indented
 * underneath, orphans (a parent filtered out by the search) promoted to root so
 * nothing ever disappears from the list.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Button as AntButton,
  Drawer,
  Form,
  Input as AntInput,
  Select as AntSelect,
  Switch,
  Tooltip,
  message,
} from 'antd';
import { Plus, Pencil, Trash2, FolderTree, CornerDownRight } from 'lucide-react';
import { DataTable, type Column, Badge } from '@/components/ui';
import RiskFilterBar, { RiskFilterField } from './RiskFilterBar';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useHasPermission } from '@/stores/authStore';
import {
  riskKeys,
  useCreateCategory,
  useDeleteCategory,
  useRiskCategories,
  useUpdateCategory,
  type RiskCategory,
} from '@/lib/api/risk';

const DEFAULT_COLOR = '#64748B';

interface CategoryFormValues {
  code?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  parentId?: string | null;
  isActive: boolean;
}

/** A category plus the depth it renders at once the list is flattened. */
type CategoryRow = RiskCategory & { depth: number };

const extractErr = (err: unknown): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Operation failed';

/**
 * Depth-first flatten. Any node whose parent is missing from `rows` (filtered
 * out, or a dangling reference) is treated as a root so it stays visible.
 */
function flattenTree(rows: RiskCategory[]): CategoryRow[] {
  const byParent = new Map<string | null, RiskCategory[]>();
  const ids = new Set(rows.map((r) => r.id));
  for (const r of rows) {
    const key = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(r);
    else byParent.set(key, [r]);
  }
  for (const bucket of byParent.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));

  const out: CategoryRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const node of byParent.get(parentId) ?? []) {
      out.push({ ...node, depth });
      walk(node.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Ids that may not be picked as a parent for `id` — itself and its subtree. */
function descendantIds(rows: RiskCategory[], id: string): Set<string> {
  const blocked = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows) {
      if (r.parent_id && blocked.has(r.parent_id) && !blocked.has(r.id)) {
        blocked.add(r.id);
        grew = true;
      }
    }
  }
  return blocked;
}

export default function RiskCategoryPage() {
  const canCreate = useHasPermission('risk_category.create');
  const canUpdate = useHasPermission('risk_category.update');
  const canDelete = useHasPermission('risk_category.delete');
  const confirmDelete = useConfirmDelete();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RiskCategory | null>(null);
  const [form] = Form.useForm<CategoryFormValues>();
  const [color, setColor] = useState<string>(DEFAULT_COLOR);

  const debouncedSearch = useDebouncedValue(search, 400);

  const { data: categories = [], isLoading } = useRiskCategories({
    search: debouncedSearch || undefined,
    isActive: activeFilter === undefined ? undefined : activeFilter === 'true',
  });
  /** Unfiltered set — the parent picker must offer categories the filter hides. */
  const { data: allCategories = [] } = useRiskCategories();

  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory(editing?.id ?? '');
  const deleteMut = useDeleteCategory();

  const rows = useMemo(() => flattenTree(categories), [categories]);
  const nameById = useMemo(
    () => new Map(allCategories.map((c) => [c.id, c.name])),
    [allCategories],
  );

  const parentOptions = useMemo(() => {
    const blocked = editing ? descendantIds(allCategories, editing.id) : new Set<string>();
    return allCategories
      .filter((c) => !blocked.has(c.id))
      .map((c) => ({ value: c.id, label: c.code ? `${c.code} — ${c.name}` : c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allCategories, editing]);

  const openCreate = () => {
    setEditing(null);
    setColor(DEFAULT_COLOR);
    form.setFieldsValue({
      code: '',
      name: '',
      description: '',
      color: DEFAULT_COLOR,
      parentId: null,
      isActive: true,
    });
    setDrawerOpen(true);
  };

  const openEdit = (c: RiskCategory) => {
    setEditing(c);
    setColor(c.color ?? DEFAULT_COLOR);
    form.setFieldsValue({
      code: c.code ?? '',
      name: c.name,
      description: c.description ?? '',
      color: c.color ?? DEFAULT_COLOR,
      parentId: c.parent_id ?? null,
      isActive: c.is_active,
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  // Clear the form once the drawer is closed so a stale draft never reappears.
  useEffect(() => {
    if (!drawerOpen) form.resetFields();
  }, [drawerOpen, form]);

  const submit = async () => {
    const values = await form.validateFields();
    const body = {
      code: values.code?.trim() || null,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      color: values.color?.trim() || null,
      parentId: values.parentId || null,
      isActive: values.isActive,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync(body);
        message.success('Category updated');
      } else {
        await createMut.mutateAsync(body);
        message.success('Category created');
      }
      closeDrawer();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const columns = useMemo<Column<CategoryRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Category',
        render: (c) => (
          <div
            className="flex items-center gap-2 min-w-0"
            style={{ paddingLeft: c.depth * 18 }}
          >
            {c.depth > 0 && <CornerDownRight size={13} className="text-gray-300 shrink-0" />}
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
              style={{ backgroundColor: c.color ?? DEFAULT_COLOR }}
            />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate max-w-[280px]">{c.name}</p>
              {c.description && (
                <p className="text-xs text-gray-500 truncate max-w-[280px]">{c.description}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'code',
        header: 'Code',
        render: (c) =>
          c.code ? (
            <span className="font-mono text-xs text-blue-700">{c.code}</span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
      },
      {
        key: 'parent',
        header: 'Parent',
        render: (c) => (
          <span className="text-xs text-gray-600">
            {c.parent_id ? (nameById.get(c.parent_id) ?? '—') : '— top level'}
          </span>
        ),
      },
      {
        key: 'is_active',
        header: 'Status',
        render: (c) => (
          <Badge variant={c.is_active ? 'success' : 'default'} dot>
            {c.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        className: 'text-right',
        render: (c) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canUpdate && (
              <Tooltip title="Edit">
                <AntButton
                  type="text"
                  size="small"
                  icon={<Pencil size={15} />}
                  onClick={() => openEdit(c)}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete">
                <AntButton
                  type="text"
                  size="small"
                  danger
                  icon={<Trash2 size={15} />}
                  onClick={() =>
                    confirmDelete({
                      entityLabel: 'risk category',
                      name: c.name,
                      extraWarning:
                        'A category still used by risks or library entries cannot be deleted.',
                      mutate: () => deleteMut.mutateAsync(c.id),
                      invalidateKey: riskKeys.all,
                    })
                  }
                />
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, canDelete, nameById],
  );

  return (
    <>
      {/* Toolbar first, then the table — the filters scope what is listed. */}
      <RiskFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name or code"
        title="Filter categories"
        activeCount={activeFilter ? 1 : 0}
        onClear={() => setActiveFilter(undefined)}
        actions={
          canCreate ? (
            <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              New category
            </AntButton>
          ) : undefined
        }
      >
        <RiskFilterField label="Status">
          <AntSelect
            allowClear
            placeholder="All statuses"
            style={{ width: '100%' }}
            value={activeFilter}
            onChange={(v) => setActiveFilter(v ?? undefined)}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
          />
        </RiskFilterField>
      </RiskFilterBar>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          pageSize={25}
          emptyMessage="No risk categories yet"
        />
      </div>

      <Drawer
        title={
          <span className="inline-flex items-center gap-2">
            <FolderTree size={16} />
            {editing ? `Edit ${editing.name}` : 'New risk category'}
          </span>
        }
        width={480}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={closeDrawer}>Cancel</AntButton>
            <AntButton
              type="primary"
              loading={createMut.isPending || updateMut.isPending}
              onClick={submit}
            >
              {editing ? 'Save changes' : 'Create category'}
            </AntButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="name"
            label="Category name"
            rules={[{ required: true, message: 'A name is required' }]}
          >
            <AntInput placeholder="e.g. Product Quality" />
          </Form.Item>
          <Form.Item name="code" label="Code" extra="Short stable key used in exports and reports.">
            <AntInput placeholder="e.g. PQ" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <AntInput.TextArea rows={3} placeholder="What belongs in this category" />
          </Form.Item>
          <Form.Item
            name="parentId"
            label="Parent category"
            extra="Leave blank to keep this a top-level category."
          >
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Top level"
              options={parentOptions}
            />
          </Form.Item>
          <Form.Item name="color" label="Colour">
            <AntInput
              addonBefore={
                <input
                  type="color"
                  aria-label="Pick colour"
                  value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR}
                  onChange={(e) => {
                    setColor(e.target.value);
                    form.setFieldsValue({ color: e.target.value });
                  }}
                  className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer align-middle"
                />
              }
              placeholder="#64748B"
              onChange={(e) => setColor(e.target.value)}
            />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
