/**
 * Risk libraries — the reusable hazard and control catalogues assessments pick
 * from instead of retyping free text. Two endpoints, one screen: the tabs share
 * the same table/drawer shape so the two catalogues never drift apart visually,
 * and the mutation hooks take the library `kind` as a variable.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Button as AntButton,
  Drawer,
  Form,
  Input as AntInput,
  InputNumber,
  Select as AntSelect,
  Switch,
  Tabs,
  Tooltip,
  message,
} from 'antd';
import { Plus, Pencil, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DataTable, type Column, Badge } from '@/components/ui';
import FilterBar, { FilterField } from '@/components/shared/FilterBar';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useHasPermission } from '@/stores/authStore';
import {
  riskKeys,
  useControlLibrary,
  useCreateLibraryItem,
  useDeleteLibraryItem,
  useHazardLibrary,
  useRiskCategories,
  useUpdateLibraryItem,
  CONTROL_HIERARCHY_LABELS,
  CONTROL_TYPE_LABELS,
  HAZARD_TYPE_LABELS,
  type ControlHierarchy,
  type ControlLibraryItem,
  type ControlType,
  type HazardLibraryItem,
  type HazardType,
} from '@/lib/api/risk';

const PAGE_SIZE = 15;

const HAZARD_TYPES = Object.keys(HAZARD_TYPE_LABELS) as HazardType[];
const CONTROL_TYPES = Object.keys(CONTROL_TYPE_LABELS) as ControlType[];
const CONTROL_HIERARCHIES = Object.keys(CONTROL_HIERARCHY_LABELS) as ControlHierarchy[];

const extractErr = (err: unknown): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Operation failed';

export default function RiskLibraryPage() {
  const [tab, setTab] = useState('hazard');

  return (
    <Tabs
      activeKey={tab}
      onChange={setTab}
      destroyInactiveTabPane
      items={[
        {
          key: 'hazard',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle size={14} /> Hazard library
            </span>
          ),
          children: <HazardLibraryTab />,
        },
        {
          key: 'control',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} /> Control library
            </span>
          ),
          children: <ControlLibraryTab />,
        },
      ]}
    />
  );
}

// ── Hazard library ──────────────────────────────────────────────────────────

interface HazardFormValues {
  code?: string | null;
  name: string;
  type: HazardType;
  description?: string | null;
  categoryId?: string | null;
  defaultSeverityRank?: number | null;
  tags?: string[] | null;
  isActive: boolean;
}

function HazardLibraryTab() {
  const canCreate = useHasPermission('risk_library.create');
  const canUpdate = useHasPermission('risk_library.update');
  const canDelete = useHasPermission('risk_library.delete');
  const confirmDelete = useConfirmDelete();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<HazardType | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<HazardLibraryItem | null>(null);
  const [form] = Form.useForm<HazardFormValues>();

  const debouncedSearch = useDebouncedValue(search, 400);
  useEffect(() => setPage(1), [debouncedSearch, type]);

  const { data, isLoading } = useHazardLibrary({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    type,
  });
  const { data: categories = [] } = useRiskCategories({ isActive: true });

  const createMut = useCreateLibraryItem();
  const updateMut = useUpdateLibraryItem(editing?.id ?? '');
  const deleteMut = useDeleteLibraryItem();

  const rows = data?.data ?? [];
  const total = data?.total ?? rows.length;

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      code: '',
      name: '',
      type: 'HAZARD',
      description: '',
      categoryId: null,
      defaultSeverityRank: null,
      tags: [],
      isActive: true,
    });
    setDrawerOpen(true);
  };

  const openEdit = (h: HazardLibraryItem) => {
    setEditing(h);
    form.setFieldsValue({
      code: h.code ?? '',
      name: h.name,
      type: h.type,
      description: h.description ?? '',
      categoryId: h.category?.id ?? null,
      defaultSeverityRank: h.default_severity_rank,
      tags: h.tags ?? [],
      isActive: h.is_active,
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const body = {
      code: values.code?.trim() || null,
      name: values.name.trim(),
      type: values.type,
      description: values.description?.trim() || null,
      categoryId: values.categoryId || null,
      defaultSeverityRank: values.defaultSeverityRank ?? null,
      tags: values.tags?.length ? values.tags : null,
      isActive: values.isActive,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ kind: 'HAZARD', body });
        message.success('Hazard updated');
      } else {
        await createMut.mutateAsync({ kind: 'HAZARD', body });
        message.success('Hazard created');
      }
      closeDrawer();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const columns = useMemo<Column<HazardLibraryItem>[]>(
    () => [
      {
        key: 'name',
        header: 'Hazard',
        render: (h) => (
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate max-w-[300px]">{h.name}</p>
            {h.description && (
              <p className="text-xs text-gray-500 truncate max-w-[300px]">{h.description}</p>
            )}
          </div>
        ),
      },
      {
        key: 'code',
        header: 'Code',
        render: (h) =>
          h.code ? (
            <span className="font-mono text-xs text-blue-700">{h.code}</span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
      },
      {
        key: 'type',
        header: 'Type',
        render: (h) => <Badge variant="info">{HAZARD_TYPE_LABELS[h.type] ?? h.type}</Badge>,
      },
      {
        key: 'category',
        header: 'Category',
        render: (h) =>
          h.category ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
              <span
                className="w-2 h-2 rounded-full border border-black/10"
                style={{ backgroundColor: h.category.color ?? '#64748B' }}
              />
              {h.category.name}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
      },
      {
        key: 'default_severity_rank',
        header: 'Default severity',
        render: (h) => (
          <span className="tabular-nums text-gray-700">{h.default_severity_rank ?? '—'}</span>
        ),
      },
      {
        key: 'tags',
        header: 'Tags',
        sortable: false,
        render: (h) =>
          h.tags?.length ? (
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {h.tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
      },
      {
        key: 'is_active',
        header: 'Status',
        render: (h) => (
          <Badge variant={h.is_active ? 'success' : 'default'} dot>
            {h.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        className: 'text-right',
        render: (h) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canUpdate && (
              <Tooltip title="Edit">
                <AntButton
                  type="text"
                  size="small"
                  icon={<Pencil size={15} />}
                  onClick={() => openEdit(h)}
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
                      entityLabel: 'hazard library entry',
                      name: h.name,
                      extraWarning: 'Assessments already referencing it keep their own copy.',
                      mutate: () => deleteMut.mutateAsync({ kind: 'HAZARD', id: h.id }),
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
    [canUpdate, canDelete],
  );

  return (
    <>
      {/* Toolbar first, then the table — the filters scope what is listed. */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name or code"
        title="Filter hazards"
        activeCount={type ? 1 : 0}
        onClear={() => setType(undefined)}
        actions={
          canCreate ? (
            <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              New hazard
            </AntButton>
          ) : undefined
        }
      >
        <FilterField label="Type">
          <AntSelect
            allowClear
            placeholder="All types"
            style={{ width: '100%' }}
            value={type}
            onChange={(v) => setType(v ?? undefined)}
            options={HAZARD_TYPES.map((t) => ({ value: t, label: HAZARD_TYPE_LABELS[t] }))}
          />
        </FilterField>
      </FilterBar>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No hazard library entries yet"
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems: total,
            onPageChange: setPage,
          }}
        />
      </div>

      <Drawer
        title={
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={16} />
            {editing ? `Edit ${editing.name}` : 'New hazard entry'}
          </span>
        }
        width={520}
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
              {editing ? 'Save changes' : 'Create hazard'}
            </AntButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'A name is required' }]}
          >
            <AntInput placeholder="e.g. Cross-contamination between product lines" />
          </Form.Item>
          <Form.Item name="code" label="Code">
            <AntInput placeholder="e.g. HZ-014" />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <AntSelect
              options={HAZARD_TYPES.map((t) => ({ value: t, label: HAZARD_TYPE_LABELS[t] }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <AntInput.TextArea rows={3} placeholder="How this hazard manifests" />
          </Form.Item>
          <Form.Item name="categoryId" label="Risk category">
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Uncategorised"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item
            name="defaultSeverityRank"
            label="Default severity rank"
            extra="Pre-fills the severity factor when this hazard is pulled into a worksheet."
          >
            <InputNumber min={1} max={10} className="w-full" placeholder="e.g. 4" />
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <AntSelect
              mode="tags"
              tokenSeparators={[',']}
              placeholder="Type and press enter"
              options={[]}
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

// ── Control library ─────────────────────────────────────────────────────────

interface ControlFormValues {
  code?: string | null;
  name: string;
  type: ControlType;
  hierarchy?: ControlHierarchy | null;
  description?: string | null;
  effectivenessRank?: number | null;
  isActive: boolean;
}

function ControlLibraryTab() {
  const canCreate = useHasPermission('risk_library.create');
  const canUpdate = useHasPermission('risk_library.update');
  const canDelete = useHasPermission('risk_library.delete');
  const confirmDelete = useConfirmDelete();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<ControlType | undefined>(undefined);
  const [hierarchy, setHierarchy] = useState<ControlHierarchy | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ControlLibraryItem | null>(null);
  const [form] = Form.useForm<ControlFormValues>();

  const debouncedSearch = useDebouncedValue(search, 400);
  useEffect(() => setPage(1), [debouncedSearch, type, hierarchy]);

  const { data, isLoading } = useControlLibrary({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    type,
    hierarchy,
  });

  const createMut = useCreateLibraryItem();
  const updateMut = useUpdateLibraryItem(editing?.id ?? '');
  const deleteMut = useDeleteLibraryItem();

  const rows = data?.data ?? [];
  const total = data?.total ?? rows.length;

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      code: '',
      name: '',
      type: 'PREVENTIVE',
      hierarchy: null,
      description: '',
      effectivenessRank: null,
      isActive: true,
    });
    setDrawerOpen(true);
  };

  const openEdit = (c: ControlLibraryItem) => {
    setEditing(c);
    form.setFieldsValue({
      code: c.code ?? '',
      name: c.name,
      type: c.type,
      hierarchy: c.hierarchy,
      description: c.description ?? '',
      effectivenessRank: c.effectiveness_rank,
      isActive: c.is_active,
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const body = {
      code: values.code?.trim() || null,
      name: values.name.trim(),
      type: values.type,
      hierarchy: values.hierarchy || null,
      description: values.description?.trim() || null,
      effectivenessRank: values.effectivenessRank ?? null,
      isActive: values.isActive,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ kind: 'CONTROL', body });
        message.success('Control updated');
      } else {
        await createMut.mutateAsync({ kind: 'CONTROL', body });
        message.success('Control created');
      }
      closeDrawer();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const columns = useMemo<Column<ControlLibraryItem>[]>(
    () => [
      {
        key: 'name',
        header: 'Control',
        render: (c) => (
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate max-w-[300px]">{c.name}</p>
            {c.description && (
              <p className="text-xs text-gray-500 truncate max-w-[300px]">{c.description}</p>
            )}
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
        key: 'type',
        header: 'Type',
        render: (c) => <Badge variant="info">{CONTROL_TYPE_LABELS[c.type] ?? c.type}</Badge>,
      },
      {
        key: 'hierarchy',
        header: 'Hierarchy',
        render: (c) =>
          c.hierarchy ? (
            <span className="text-xs text-gray-700">
              {CONTROL_HIERARCHY_LABELS[c.hierarchy] ?? c.hierarchy}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
      },
      {
        key: 'effectiveness_rank',
        header: 'Effectiveness',
        render: (c) => (
          <span className="tabular-nums text-gray-700">{c.effectiveness_rank ?? '—'}</span>
        ),
      },
      {
        key: 'usage_count',
        header: 'In use',
        render: (c) => <span className="tabular-nums text-gray-700">{c.usage_count}</span>,
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
                      entityLabel: 'control library entry',
                      name: c.name,
                      extraWarning:
                        'A control already attached to risks cannot be deleted; deactivate it instead.',
                      mutate: () => deleteMut.mutateAsync({ kind: 'CONTROL', id: c.id }),
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
    [canUpdate, canDelete],
  );

  return (
    <>
      {/* Toolbar first, then the table — the filters scope what is listed. */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name or code"
        title="Filter controls"
        activeCount={(type ? 1 : 0) + (hierarchy ? 1 : 0)}
        onClear={() => {
          setType(undefined);
          setHierarchy(undefined);
        }}
        actions={
          canCreate ? (
            <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              New control
            </AntButton>
          ) : undefined
        }
      >
        <FilterField label="Type">
          <AntSelect
            allowClear
            placeholder="All types"
            style={{ width: '100%' }}
            value={type}
            onChange={(v) => setType(v ?? undefined)}
            options={CONTROL_TYPES.map((t) => ({ value: t, label: CONTROL_TYPE_LABELS[t] }))}
          />
        </FilterField>
        <FilterField label="Hierarchy">
          <AntSelect
            allowClear
            placeholder="All hierarchies"
            style={{ width: '100%' }}
            value={hierarchy}
            onChange={(v) => setHierarchy(v ?? undefined)}
            options={CONTROL_HIERARCHIES.map((h) => ({
              value: h,
              label: CONTROL_HIERARCHY_LABELS[h],
            }))}
          />
        </FilterField>
      </FilterBar>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No control library entries yet"
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems: total,
            onPageChange: setPage,
          }}
        />
      </div>

      <Drawer
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={16} />
            {editing ? `Edit ${editing.name}` : 'New control entry'}
          </span>
        }
        width={520}
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
              {editing ? 'Save changes' : 'Create control'}
            </AntButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'A name is required' }]}
          >
            <AntInput placeholder="e.g. Line clearance verified by second person" />
          </Form.Item>
          <Form.Item name="code" label="Code">
            <AntInput placeholder="e.g. CTL-023" />
          </Form.Item>
          <Form.Item name="type" label="Control type" rules={[{ required: true }]}>
            <AntSelect
              options={CONTROL_TYPES.map((t) => ({ value: t, label: CONTROL_TYPE_LABELS[t] }))}
            />
          </Form.Item>
          <Form.Item
            name="hierarchy"
            label="Hierarchy of controls"
            extra="Higher-order controls (elimination, substitution) are inherently more reliable."
          >
            <AntSelect
              allowClear
              placeholder="Not classified"
              options={CONTROL_HIERARCHIES.map((h) => ({
                value: h,
                label: CONTROL_HIERARCHY_LABELS[h],
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <AntInput.TextArea rows={3} placeholder="What the control does and how it is evidenced" />
          </Form.Item>
          <Form.Item
            name="effectivenessRank"
            label="Effectiveness rank"
            extra="Relative strength of this control, used when comparing mitigation options."
          >
            <InputNumber min={1} max={10} className="w-full" placeholder="e.g. 3" />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
