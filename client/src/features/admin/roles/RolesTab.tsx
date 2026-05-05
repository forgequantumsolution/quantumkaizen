import { useEffect, useMemo, useState } from 'react';
import { Formik, Form, type FormikHelpers } from 'formik';
import * as Yup from 'yup';
import {
  Button as AntButton,
  Modal as AntModal,
  Input as AntInput,
  Table as AntTable,
  Tag as AntTag,
  Form as AntForm,
  Checkbox as AntCheckbox,
  Empty,
  type TableColumnsType,
} from 'antd';
import { Plus, Pencil, Trash2, Lock } from 'lucide-react';
import {
  useRoles,
  usePermissionsGrouped,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  type Role,
  type CreateRoleInput,
} from './hooks';
import { useHasPermission } from '@/stores/authStore';

interface FormValues {
  name: string;
  description: string;
  permissionIds: string[];
}

const emptyValues: FormValues = { name: '', description: '', permissionIds: [] };

const buildSchema = (isEditing: boolean) =>
  Yup.object({
    name: isEditing
      ? Yup.string()
      : Yup.string()
          .matches(/^[A-Z0-9_]{2,40}$/, 'Name must be 2–40 chars: A-Z, 0-9, _')
          .required('Name is required'),
    description: Yup.string().max(500).nullable(),
    permissionIds: Yup.array().of(Yup.string().required()).default([]),
  });

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

export default function RolesTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const filters = useMemo(
    () => ({ search: search.trim() || undefined, page, pageSize }),
    [search, page, pageSize],
  );
  const { data: rolesResp, isLoading } = useRoles(filters);
  const roles = rolesResp?.items ?? [];
  const total = rolesResp?.total ?? 0;
  const { data: permGroups = [] } = usePermissionsGrouped();

  useEffect(() => {
    setPage(1);
  }, [search]);
  const create = useCreateRole();
  const update = useUpdateRole();
  const remove = useDeleteRole();

  const canCreate = useHasPermission('role.create');
  const canUpdate = useHasPermission('role.update');
  const canDelete = useHasPermission('role.delete');

  const [editing, setEditing] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const allPermissions = useMemo(
    () => permGroups.flatMap((g) => g.permissions.map((p) => ({ ...p, module: g.module }))),
    [permGroups],
  );

  const initialValues = useMemo<FormValues>(() => {
    if (!editing) return emptyValues;
    return {
      name: editing.name,
      description: editing.description ?? '',
      permissionIds: editing.permissions.map((p) => p.id),
    };
  }, [editing]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (role: Role) => {
    setEditing(role);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError(null);
  };

  const handleSubmit = async (values: FormValues, helpers: FormikHelpers<FormValues>) => {
    setFormError(null);
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          description: values.description.trim() || null,
          permissionIds: values.permissionIds,
        });
      } else {
        await create.mutateAsync({
          name: values.name.trim().toUpperCase(),
          description: values.description.trim() || null,
          permissionIds: values.permissionIds,
        } as CreateRoleInput);
      }
      closeForm();
    } catch (err) {
      setFormError(extractApiError(err));
    } finally {
      helpers.setSubmitting(false);
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

  const columns: TableColumnsType<Role> = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name: string, role) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-slate-900">{name}</span>
          {role.isSystem && <Lock size={12} className="text-gray-400" />}
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (d: string | null) => d ?? <span className="text-gray-300">—</span>,
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      width: 120,
      render: (perms: Role['permissions']) => (
        <span className="text-gray-600">
          <span className="font-medium text-slate-900">{perms.length}</span>
          <span className="text-xs text-gray-400"> / {allPermissions.length}</span>
        </span>
      ),
    },
    {
      title: 'Users',
      dataIndex: ['_count', 'users'],
      width: 80,
      align: 'center',
    },
    {
      title: 'Type',
      dataIndex: 'isSystem',
      width: 100,
      render: (system: boolean) =>
        system ? <AntTag color="blue">System</AntTag> : <AntTag>Custom</AntTag>,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, role) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <AntButton
              type="text"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => openEdit(role)}
            />
          )}
          {canDelete && (
            <AntButton
              type="text"
              size="small"
              danger
              disabled={role.isSystem}
              icon={<Trash2 size={14} />}
              onClick={() => {
                setConfirmDelete(role);
                setDeleteError(null);
              }}
              title={role.isSystem ? 'System roles cannot be deleted' : 'Delete'}
            />
          )}
          {!canUpdate && !canDelete && <span className="text-xs text-gray-300">—</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <AntInput.Search
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles…"
          allowClear
          style={{ maxWidth: 320 }}
        />
        {canCreate && (
          <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Add Role
          </AntButton>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <AntTable<Role>
          rowKey="id"
          columns={columns}
          dataSource={roles}
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
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No roles" />,
          }}
        />
      </div>

      {/* Create/Edit Modal */}
      <Formik<FormValues>
        enableReinitialize
        initialValues={initialValues}
        validationSchema={buildSchema(!!editing)}
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, setFieldValue, handleSubmit, isSubmitting, resetForm }) => {
          const togglePermission = (id: string) => {
            const set = new Set(values.permissionIds);
            if (set.has(id)) set.delete(id);
            else set.add(id);
            setFieldValue('permissionIds', [...set]);
          };

          const toggleModule = (moduleKey: string) => {
            const group = permGroups.find((g) => g.module === moduleKey);
            if (!group) return;
            const set = new Set(values.permissionIds);
            const allSelected = group.permissions.every((p) => set.has(p.id));
            if (allSelected) group.permissions.forEach((p) => set.delete(p.id));
            else group.permissions.forEach((p) => set.add(p.id));
            setFieldValue('permissionIds', [...set]);
          };

          return (
            <AntModal
              title={editing ? `Edit Role · ${editing.name}` : 'Add Role'}
              open={showForm}
              onCancel={() => {
                resetForm();
                closeForm();
              }}
              width={760}
              destroyOnClose
              footer={[
                <AntButton
                  key="cancel"
                  onClick={() => {
                    resetForm();
                    closeForm();
                  }}
                >
                  Cancel
                </AntButton>,
                <AntButton key="ok" type="primary" loading={isSubmitting} onClick={() => handleSubmit()}>
                  {editing ? 'Save Changes' : 'Create Role'}
                </AntButton>,
              ]}
            >
              <AntForm layout="vertical" component={false}>
              <Form>
                {formError && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {formError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4">
                  <AntForm.Item
                    label="Name"
                    required
                    validateStatus={touched.name && errors.name ? 'error' : ''}
                    help={
                      (touched.name && errors.name) ||
                      '2–40 chars: A-Z, 0-9, _ (immutable after creation)'
                    }
                  >
                    <AntInput
                      value={values.name}
                      onChange={(e) => setFieldValue('name', e.target.value.toUpperCase())}
                      placeholder="QUALITY_ENGINEER"
                      disabled={!!editing}
                      maxLength={40}
                    />
                  </AntForm.Item>
                  <AntForm.Item label="Description">
                    <AntInput
                      value={values.description}
                      onChange={(e) => setFieldValue('description', e.target.value)}
                      placeholder="What can this role do?"
                    />
                  </AntForm.Item>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Permissions</label>
                    <span className="text-xs text-gray-500">
                      {values.permissionIds.length} selected
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {permGroups.map((group) => {
                      const groupSelected = group.permissions.filter((p) =>
                        values.permissionIds.includes(p.id),
                      ).length;
                      const allSelected = groupSelected === group.permissions.length;
                      return (
                        <div
                          key={group.module}
                          className="border border-gray-200 rounded-lg overflow-hidden"
                        >
                          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-900">
                                {group.module}
                              </span>
                              <span className="text-xs text-gray-500">
                                {groupSelected} / {group.permissions.length}
                              </span>
                            </div>
                            <AntButton
                              type="link"
                              size="small"
                              onClick={() => toggleModule(group.module)}
                            >
                              {allSelected ? 'Clear' : 'Select all'}
                            </AntButton>
                          </div>
                          <div className="p-2 grid grid-cols-2 gap-1">
                            {group.permissions.map((p) => (
                              <label
                                key={p.id}
                                className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                              >
                                <AntCheckbox
                                  checked={values.permissionIds.includes(p.id)}
                                  onChange={() => togglePermission(p.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-mono text-xs font-medium text-slate-900">
                                    {p.action}
                                  </div>
                                  <div className="text-xs text-gray-500 line-clamp-1">
                                    {p.description}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Form>
              </AntForm>
            </AntModal>
          );
        }}
      </Formik>

      {/* Delete confirmation */}
      <AntModal
        title="Delete Role"
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
          Delete <span className="font-semibold">{confirmDelete?.name}</span>?
        </p>
        <p className="text-xs text-gray-500 mb-0">
          This is permanent. Roles assigned to any user cannot be deleted.
        </p>
      </AntModal>
    </div>
  );
}
