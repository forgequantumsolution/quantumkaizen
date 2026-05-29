import { useEffect, useMemo, useState } from 'react';
import {
  Button as AntButton,
  Modal as AntModal,
  Input as AntInput,
  Select as AntSelect,
  Switch as AntSwitch,
  Table as AntTable,
  Tag as AntTag,
  Empty,
  type TableColumnsType,
} from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { AppForm } from '@/components/ui';
import {
  useSites,
  useCreateSite,
  useUpdateSite,
  useDeleteSite,
  type Site,
  type CreateSiteInput,
} from '@/lib/api/sites';
import { useHasPermission } from '@/stores/authStore';

interface FormValues {
  code: string;
  name: string;
  address: string;
  isActive: boolean;
}

const emptyValues: FormValues = { code: '', name: '', address: '', isActive: true };

const buildPayload = (v: FormValues): CreateSiteInput => ({
  code: v.code.trim().toUpperCase(),
  name: v.name.trim(),
  address: v.address?.trim() || null,
  isActive: v.isActive,
});

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

export default function SitesTab() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      isActive:
        activeFilter === 'all' ? undefined : activeFilter === 'active' ? ('true' as const) : ('false' as const),
      page,
      pageSize,
    }),
    [search, activeFilter, page, pageSize],
  );

  const { data, isLoading } = useSites(filters);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const create = useCreateSite();
  const update = useUpdateSite();
  const remove = useDeleteSite();

  const canCreate = useHasPermission('org.update');
  const canUpdate = useHasPermission('org.update');
  const canDelete = useHasPermission('org.update');

  const [editing, setEditing] = useState<Site | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Site | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [form] = AppForm.useForm<FormValues>();

  const initialValues = useMemo<FormValues>(() => {
    if (!editing) return emptyValues;
    return {
      code: editing.code,
      name: editing.name,
      address: editing.address ?? '',
      isActive: editing.isActive,
    };
  }, [editing]);

  useEffect(() => {
    if (showForm) form.setFieldsValue(initialValues);
  }, [showForm, initialValues, form]);

  const closeForm = () => {
    setShowForm(false);
    setFormError(null);
    form.resetFields();
  };

  const handleFinish = async (values: FormValues) => {
    setFormError(null);
    const payload = buildPayload(values);
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      closeForm();
    } catch (err) {
      setFormError(extractApiError(err));
    }
  };

  const submitDelete = async () => {
    if (!confirmDelete) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(extractApiError(err, 'Delete failed'));
    }
  };

  const columns: TableColumnsType<Site> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 120,
      render: (code: string) => (
        <span className="font-mono text-xs font-semibold text-slate-900">{code}</span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_: string, s: Site) => (
        <div>
          <p className="font-medium text-gray-900 mb-0">{s.name}</p>
          {s.address && <p className="text-xs text-gray-500 mb-0 line-clamp-1">{s.address}</p>}
        </div>
      ),
    },
    {
      title: 'Users',
      dataIndex: ['_count', 'users'],
      width: 80,
      align: 'center',
    },
    {
      title: 'Tickets',
      dataIndex: ['_count', 'tickets'],
      width: 80,
      align: 'center',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      width: 100,
      render: (active: boolean) => (
        <AntTag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</AntTag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, s) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <AntButton
              type="text"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => { setEditing(s); setFormError(null); setShowForm(true); }}
            />
          )}
          {canDelete && (
            <AntButton
              type="text"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              onClick={() => { setConfirmDelete(s); setDeleteError(null); }}
            />
          )}
          {!canUpdate && !canDelete && <span className="text-xs text-gray-300">—</span>}
        </div>
      ),
    },
  ];

  const isSaving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <AntInput.Search
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or code…"
            allowClear
            style={{ flex: 1 }}
          />
          <AntSelect
            value={activeFilter}
            onChange={(v) => { setActiveFilter(v); setPage(1); }}
            style={{ width: 144 }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
        {canCreate && (
          <AntButton
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => { setEditing(null); setFormError(null); setShowForm(true); }}
          >
            Add Site
          </AntButton>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <AntTable<Site>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t, range) => `${range[0]}–${range[1]} of ${t}`,
            onChange: (next, nextSize) => {
              setPage(next);
              if (nextSize !== pageSize) setPageSize(nextSize);
            },
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No sites — add your first one."
              />
            ),
          }}
        />
      </div>

      <AntModal
        title={editing ? `Edit Site · ${editing.code}` : 'Add Site'}
        open={showForm}
        onCancel={closeForm}
        width={560}
        destroyOnClose
        footer={[
          <AntButton key="cancel" onClick={closeForm}>Cancel</AntButton>,
          <AntButton key="ok" type="primary" loading={isSaving} onClick={() => form.submit()}>
            {editing ? 'Save Changes' : 'Create Site'}
          </AntButton>,
        ]}
      >
        <AppForm<FormValues>
          form={form}
          initialValues={initialValues}
          onFinish={handleFinish}
        >
          {formError && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4">
            <AppForm.Item
              label="Code"
              name="code"
              normalize={(v: string) => (v ?? '').toUpperCase()}
              help="2–16 chars: A-Z, 0-9, _ or -"
              rules={[
                { required: true, message: 'Code is required' },
                { pattern: /^[A-Z0-9_-]{2,16}$/, message: 'Code must be 2–16 chars: A-Z, 0-9, _, -' },
              ]}
            >
              <AntInput placeholder="PUNE, BOM, US-1…" disabled={!!editing} maxLength={16} />
            </AppForm.Item>
            <AppForm.Item
              label="Name"
              name="name"
              rules={[
                { required: true, message: 'Name is required' },
                { max: 120, message: 'At most 120 characters' },
              ]}
            >
              <AntInput placeholder="Pune Manufacturing" />
            </AppForm.Item>
            <AppForm.Item label="Address" name="address" className="col-span-2">
              <AntInput.TextArea rows={2} placeholder="Postal address (optional)" />
            </AppForm.Item>
            <div className="col-span-2 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-0">Active</p>
                <p className="text-xs text-gray-500 mb-0">
                  Inactive sites stay in the database but are hidden from default dropdowns.
                </p>
              </div>
              <AppForm.Item name="isActive" valuePropName="checked" className="!mb-0">
                <AntSwitch />
              </AppForm.Item>
            </div>
          </div>
        </AppForm>
      </AntModal>

      <AntModal
        title="Delete Site"
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        width={420}
        footer={[
          <AntButton key="cancel" onClick={() => setConfirmDelete(null)}>Cancel</AntButton>,
          <AntButton
            key="delete"
            danger
            type="primary"
            loading={remove.isPending}
            onClick={submitDelete}
          >
            Delete
          </AntButton>,
        ]}
      >
        {deleteError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {deleteError}
          </div>
        )}
        <p className="text-sm text-gray-700 mb-2">
          Delete <span className="font-semibold">{confirmDelete?.name}</span> ({confirmDelete?.code})?
        </p>
        <p className="text-xs text-gray-500 mb-0">
          This is permanent. Sites with assigned users or tickets cannot be deleted.
        </p>
      </AntModal>
    </div>
  );
}
