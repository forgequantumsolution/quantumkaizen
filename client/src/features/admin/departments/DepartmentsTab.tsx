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
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  type Department,
  type CreateDepartmentInput,
} from './hooks';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useHasPermission } from '@/stores/authStore';

interface FormValues {
  code: string;
  name: string;
  description: string;
  parentId: string;
  headUserId: string;
  costCenter: string;
  isActive: boolean;
}

const emptyValues: FormValues = {
  code: '',
  name: '',
  description: '',
  parentId: '',
  headUserId: '',
  costCenter: '',
  isActive: true,
};

const buildPayload = (values: FormValues): CreateDepartmentInput => ({
  code: values.code.trim().toUpperCase(),
  name: values.name.trim(),
  description: values.description?.trim() || null,
  parentId: values.parentId || null,
  headUserId: values.headUserId || null,
  costCenter: values.costCenter?.trim() || null,
  isActive: values.isActive,
});

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

export default function DepartmentsTab() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
      page,
      pageSize,
    }),
    [search, activeFilter, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [search, activeFilter]);

  const { data: deptResp, isLoading } = useDepartments(filters);
  const departments = deptResp?.items ?? [];
  const total = deptResp?.total ?? 0;
  // Parent-department dropdown needs every department, not just the current page.
  const { data: allDeptResp } = useDepartments({ pageSize: 200 });
  const allDepartments = allDeptResp?.items ?? [];
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const remove = useDeleteDepartment();

  const canCreate = useHasPermission('department.create');
  const canUpdate = useHasPermission('department.update');
  const canDelete = useHasPermission('department.delete');

  const [editing, setEditing] = useState<Department | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [form] = AppForm.useForm<FormValues>();

  const initialValues = useMemo<FormValues>(() => {
    if (!editing) return emptyValues;
    return {
      code: editing.code,
      name: editing.name,
      description: editing.description ?? '',
      parentId: editing.parentId ?? '',
      headUserId: editing.headUserId ?? '',
      costCenter: editing.costCenter ?? '',
      isActive: editing.isActive,
    };
  }, [editing]);

  // Seed the form whenever the modal opens or the editing target changes.
  useEffect(() => {
    if (showForm) form.setFieldsValue(initialValues);
  }, [showForm, initialValues, form]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setFormError(null);
    setShowForm(true);
  };

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

  const columns: TableColumnsType<Department> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 100,
      render: (code: string) => (
        <span className="font-mono text-xs font-semibold text-slate-900">{code}</span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_: string, dept: Department) => (
        <div>
          <p className="font-medium text-gray-900 mb-0">{dept.name}</p>
          {dept.description && (
            <p className="text-xs text-gray-500 mb-0 line-clamp-1">{dept.description}</p>
          )}
        </div>
      ),
    },
    {
      title: 'Parent',
      dataIndex: 'parent',
      render: (parent: Department['parent']) =>
        parent ? (
          <span className="text-xs text-gray-600">
            <span className="font-mono">{parent.code}</span> · {parent.name}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      title: 'Head',
      dataIndex: 'head',
      render: (head: Department['head']) =>
        head ? <span className="text-gray-700">{head.name}</span> : <span className="text-gray-300">—</span>,
    },
    {
      title: 'Users',
      dataIndex: ['_count', 'users'],
      width: 80,
      align: 'center',
    },
    {
      title: 'Cost Center',
      dataIndex: 'costCenter',
      render: (cc: string | null) => cc ?? <span className="text-gray-300">—</span>,
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
      render: (_, dept) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <AntButton
              type="text"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => openEdit(dept)}
            />
          )}
          {canDelete && (
            <AntButton
              type="text"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              onClick={() => {
                setConfirmDelete(dept);
                setDeleteError(null);
              }}
            />
          )}
          {!canUpdate && !canDelete && <span className="text-xs text-gray-300">—</span>}
        </div>
      ),
    },
  ];

  const parentOptions = allDepartments
    .filter((d) => !editing || d.id !== editing.id)
    .map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }));

  // People directory for the department-head picker — the head is the top rung
  // of the escalation ladder (DEPARTMENT_HEAD), so an unset head means that
  // level can't fire.
  const { data: directory } = useUserDirectory();
  const headOptions = (directory?.items ?? []).map((u) => ({
    value: u.id,
    label: u.designation ? `${u.name} · ${u.designation}` : u.name,
  }));

  const isSaving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <AntInput.Search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            allowClear
            style={{ flex: 1 }}
          />
          <AntSelect
            value={activeFilter}
            onChange={setActiveFilter}
            style={{ width: 144 }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
        {canCreate && (
          <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Add Department
          </AntButton>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <AntTable<Department>
          rowKey="id"
          columns={columns}
          dataSource={departments}
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
                description="No departments — add your first one."
              />
            ),
          }}
        />
      </div>

      {/* Create/Edit Modal */}
      <AntModal
        title={editing ? `Edit Department · ${editing.code}` : 'Add Department'}
        open={showForm}
        onCancel={closeForm}
        width={680}
        destroyOnClose
        footer={[
          <AntButton key="cancel" onClick={closeForm}>
            Cancel
          </AntButton>,
          <AntButton
            key="ok"
            type="primary"
            loading={isSaving}
            onClick={() => form.submit()}
          >
            {editing ? 'Save Changes' : 'Create Department'}
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
                {
                  pattern: /^[A-Z0-9_-]{2,16}$/,
                  message: 'Code must be 2–16 chars: A-Z, 0-9, _, -',
                },
              ]}
            >
              <AntInput placeholder="QA, MFG, ENG…" disabled={!!editing} maxLength={16} />
            </AppForm.Item>
            <AppForm.Item
              label="Name"
              name="name"
              rules={[
                { required: true, message: 'Name is required' },
                { max: 120, message: 'At most 120 characters' },
              ]}
            >
              <AntInput placeholder="Quality Assurance" />
            </AppForm.Item>
            <AppForm.Item label="Description" name="description" className="col-span-2">
              <AntInput.TextArea rows={2} placeholder="What does this department do?" />
            </AppForm.Item>
            <AppForm.Item label="Parent Department" name="parentId">
              <AntSelect
                placeholder="None (top-level)"
                allowClear
                options={parentOptions}
              />
            </AppForm.Item>
            <AppForm.Item
              label="Head"
              name="headUserId"
              help="Escalation target for this department (DEPARTMENT_HEAD)"
            >
              <AntSelect
                placeholder="Unassigned"
                allowClear
                showSearch
                optionFilterProp="label"
                options={headOptions}
              />
            </AppForm.Item>
            <AppForm.Item label="Cost Center" name="costCenter">
              <AntInput placeholder="CC-1001" />
            </AppForm.Item>
            <div className="col-span-2 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-0">Active</p>
                <p className="text-xs text-gray-500 mb-0">
                  Inactive departments stay in the database but are hidden from default lists.
                </p>
              </div>
              <AppForm.Item name="isActive" valuePropName="checked" className="!mb-0">
                <AntSwitch />
              </AppForm.Item>
            </div>
          </div>
        </AppForm>
      </AntModal>

      {/* Delete confirmation */}
      <AntModal
        title="Delete Department"
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        width={420}
        footer={[
          <AntButton key="cancel" onClick={() => setConfirmDelete(null)}>
            Cancel
          </AntButton>,
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
          This is permanent. Departments with assigned users or sub-departments cannot be deleted.
        </p>
      </AntModal>
    </div>
  );
}
