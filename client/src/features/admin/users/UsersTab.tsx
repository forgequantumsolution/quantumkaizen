import { useEffect, useMemo, useState } from 'react';
import {
  Button as AntButton,
  Modal as AntModal,
  Input as AntInput,
  Select as AntSelect,
  Switch as AntSwitch,
  Table as AntTable,
  Tag as AntTag,
  DatePicker as AntDatePicker,
  Empty,
  Avatar as AntAvatar,
  type TableColumnsType,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Plus, Pencil, KeyRound, Power, RotateCcw } from 'lucide-react';
import { AppForm } from '@/components/ui';
import {
  useAdminUsers,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useReactivateUser,
  useResetUserPassword,
  type AdminUser,
  type CreateUserInput,
} from './hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useRoles } from '@/features/admin/roles/hooks';
import { useHasPermission } from '@/stores/authStore';

interface FormValues {
  email: string;
  password: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string;
  designation: string;
  departmentId: string;
  roleId: string;
  managerId: string;
  joinDate: Dayjs | null;
  isActive: boolean;
}

const emptyValues: FormValues = {
  email: '',
  password: '',
  employeeId: '',
  firstName: '',
  lastName: '',
  phone: '',
  designation: '',
  departmentId: '',
  roleId: '',
  managerId: '',
  joinDate: null,
  isActive: true,
};

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

export default function UsersTab() {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      departmentId: departmentFilter || undefined,
      roleId: roleFilter || undefined,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      page,
      pageSize,
    }),
    [search, departmentFilter, roleFilter, statusFilter, page, pageSize],
  );

  const { data: usersResponse, isLoading } = useAdminUsers(filters);
  const users = usersResponse?.items ?? [];
  const total = usersResponse?.total ?? 0;

  // Filter changes invalidate the current page index.
  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, roleFilter, statusFilter]);
  // Dropdowns need full lists, not just one page.
  const { data: deptResp } = useDepartments({ isActive: true, pageSize: 200 });
  const departments = deptResp?.items ?? [];
  const { data: rolesResp } = useRoles({ pageSize: 200 });
  const roles = rolesResp?.items ?? [];
  const { data: managerPool } = useAdminUsers({ isActive: true, pageSize: 200 });

  const create = useCreateUser();
  const update = useUpdateUser();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const resetPw = useResetUserPassword();

  const canCreate = useHasPermission('user.create');
  const canUpdate = useHasPermission('user.update');
  const canDelete = useHasPermission('user.delete');

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const [form] = AppForm.useForm<FormValues>();
  const [resetForm] = AppForm.useForm<{ password: string }>();

  const initialValues = useMemo<FormValues>(() => {
    if (!editing) return emptyValues;
    return {
      email: editing.email,
      password: '',
      employeeId: editing.employeeId ?? '',
      firstName: editing.firstName ?? '',
      lastName: editing.lastName ?? '',
      phone: editing.phone ?? '',
      designation: editing.designation ?? '',
      departmentId: editing.departmentId ?? '',
      roleId: editing.roleId ?? '',
      managerId: editing.managerId ?? '',
      joinDate: editing.joinDate ? dayjs(editing.joinDate) : null,
      isActive: editing.isActive,
    };
  }, [editing]);

  useEffect(() => {
    if (showForm) form.setFieldsValue(initialValues);
  }, [showForm, initialValues, form]);

  useEffect(() => {
    if (resetTarget) {
      resetForm.resetFields();
      setResetError(null);
      setResetDone(false);
    }
  }, [resetTarget, resetForm]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditing(user);
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
    const basePayload = {
      email: values.email.trim(),
      employeeId: values.employeeId.trim() || null,
      firstName: values.firstName.trim() || null,
      lastName: values.lastName.trim() || null,
      phone: values.phone.trim() || null,
      designation: values.designation.trim() || null,
      departmentId: values.departmentId || null,
      roleId: values.roleId || null,
      managerId: values.managerId || null,
      joinDate: values.joinDate ? values.joinDate.toISOString() : null,
      isActive: values.isActive,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...basePayload });
      else await create.mutateAsync({ ...basePayload, password: values.password } as CreateUserInput);
      closeForm();
    } catch (err) {
      setFormError(extractApiError(err));
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      if (user.isActive) await deactivate.mutateAsync(user.id);
      else await reactivate.mutateAsync(user.id);
    } catch {
      // noop — react-query state surfaces error
    }
  };

  const closeReset = () => {
    setResetTarget(null);
    resetForm.resetFields();
    setResetError(null);
    setResetDone(false);
  };

  const handleResetFinish = async (values: { password: string }) => {
    if (!resetTarget) return;
    setResetError(null);
    try {
      await resetPw.mutateAsync({ id: resetTarget.id, password: values.password });
      setResetDone(true);
    } catch (err) {
      setResetError(extractApiError(err, 'Reset failed'));
    }
  };

  const columns: TableColumnsType<AdminUser> = [
    {
      title: 'User',
      dataIndex: 'name',
      render: (_: string, user) => {
        const initials = `${(user.firstName?.[0] ?? user.name[0] ?? '?').toUpperCase()}${(
          user.lastName?.[0] ?? ''
        ).toUpperCase()}`;
        return (
          <div className="flex items-center gap-2.5">
            <AntAvatar style={{ background: '#0f172a' }}>{initials}</AntAvatar>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 mb-0">{user.name}</p>
              <p className="text-xs text-gray-500 mb-0">{user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Employee ID',
      dataIndex: 'employeeId',
      width: 130,
      render: (id: string | null) =>
        id ? (
          <span className="font-mono text-xs text-slate-900">{id}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      render: (d: string | null) => d ?? <span className="text-gray-300">—</span>,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      render: (dept: AdminUser['department']) =>
        dept ? (
          <span>
            <span className="font-mono text-xs text-gray-500">{dept.code}</span> · {dept.name}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (role: AdminUser['role']) =>
        role ? <AntTag color="blue">{role.name}</AntTag> : <span className="text-gray-300">—</span>,
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
      width: 130,
      render: (_, user) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <AntButton
              type="text"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => openEdit(user)}
            />
          )}
          {canUpdate && (
            <AntButton
              type="text"
              size="small"
              icon={<KeyRound size={14} />}
              onClick={() => setResetTarget(user)}
              title="Reset password"
            />
          )}
          {(user.isActive ? canDelete : canUpdate) && (
            <AntButton
              type="text"
              size="small"
              danger={user.isActive}
              icon={user.isActive ? <Power size={14} /> : <RotateCcw size={14} />}
              onClick={() => handleToggleActive(user)}
              title={user.isActive ? 'Deactivate' : 'Reactivate'}
            />
          )}
          {!canUpdate && !canDelete && <span className="text-xs text-gray-300">—</span>}
        </div>
      ),
    },
  ];

  const managerOptions = (managerPool?.items ?? [])
    .filter((u) => !editing || u.id !== editing.id)
    .map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }));

  const isSaving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[400px] max-w-3xl">
          <AntInput.Search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, employee ID…"
            allowClear
            style={{ flex: 1 }}
          />
          <AntSelect
            value={departmentFilter || undefined}
            onChange={(v) => setDepartmentFilter(v ?? '')}
            placeholder="All departments"
            allowClear
            style={{ width: 176 }}
            options={departments.map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
          />
          <AntSelect
            value={roleFilter || undefined}
            onChange={(v) => setRoleFilter(v ?? '')}
            placeholder="All roles"
            allowClear
            style={{ width: 176 }}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />
          <AntSelect
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 128 }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
        {canCreate && (
          <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Add User
          </AntButton>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <AntTable<AdminUser>
          rowKey="id"
          columns={columns}
          dataSource={users}
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
          rowClassName={(record) => (!record.isActive ? 'opacity-60' : '')}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No users found" />,
          }}
        />
      </div>

      {/* Create/Edit Modal */}
      <AntModal
        title={editing ? `Edit User · ${editing.name}` : 'Add User'}
        open={showForm}
        onCancel={closeForm}
        width={760}
        destroyOnClose
        footer={[
          <AntButton key="cancel" onClick={closeForm}>
            Cancel
          </AntButton>,
          <AntButton key="ok" type="primary" loading={isSaving} onClick={() => form.submit()}>
            {editing ? 'Save Changes' : 'Create User'}
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

          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Identity
          </h3>
          <div className="grid grid-cols-2 gap-x-4">
            <AppForm.Item
              label="Employee ID"
              name="employeeId"
              normalize={(v: string) => (v ?? '').toUpperCase()}
              rules={[
                {
                  validator: (_, v: string) =>
                    !v || /^[A-Z0-9_-]{2,32}$/.test(v)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Employee ID: 2–32 chars A-Z 0-9 _ -')),
                },
              ]}
            >
              <AntInput placeholder="EMP-001" maxLength={32} />
            </AppForm.Item>
            <AppForm.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Email is required' },
                { type: 'email', message: 'Enter a valid email' },
              ]}
            >
              <AntInput type="email" placeholder="user@company.com" disabled={!!editing} />
            </AppForm.Item>
            <AppForm.Item
              label="First Name"
              name="firstName"
              dependencies={['lastName']}
              rules={[
                { max: 60, message: 'At most 60 characters' },
                ({ getFieldValue }) => ({
                  validator(_, v: string) {
                    if (v || getFieldValue('lastName')) return Promise.resolve();
                    return Promise.reject(new Error('Provide at least a first or last name'));
                  },
                }),
              ]}
            >
              <AntInput placeholder="Priya" />
            </AppForm.Item>
            <AppForm.Item
              label="Last Name"
              name="lastName"
              rules={[{ max: 60, message: 'At most 60 characters' }]}
            >
              <AntInput placeholder="Sharma" />
            </AppForm.Item>
            <AppForm.Item label="Phone" name="phone" rules={[{ max: 40 }]}>
              <AntInput placeholder="+91 98765 43210" />
            </AppForm.Item>
            <AppForm.Item label="Designation" name="designation" rules={[{ max: 120 }]}>
              <AntInput placeholder="Senior Quality Engineer" />
            </AppForm.Item>
          </div>

          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-2">
            Organization
          </h3>
          <div className="grid grid-cols-2 gap-x-4">
            <AppForm.Item label="Department" name="departmentId">
              <AntSelect
                placeholder="— None —"
                allowClear
                options={departments.map((d) => ({
                  value: d.id,
                  label: `${d.code} · ${d.name}`,
                }))}
              />
            </AppForm.Item>
            <AppForm.Item label="Role" name="roleId">
              <AntSelect
                placeholder="— None —"
                allowClear
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
              />
            </AppForm.Item>
            <AppForm.Item label="Manager" name="managerId">
              <AntSelect
                placeholder="— None —"
                allowClear
                showSearch
                optionFilterProp="label"
                options={managerOptions}
              />
            </AppForm.Item>
            <AppForm.Item label="Join Date" name="joinDate">
              <AntDatePicker style={{ width: '100%' }} />
            </AppForm.Item>
          </div>

          {!editing && (
            <>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-2">
                Initial Password
              </h3>
              <AppForm.Item
                label="Password"
                name="password"
                help="The user can change this later from their profile."
                rules={[
                  { required: true, message: 'Password is required' },
                  { min: 8, message: 'At least 8 characters' },
                ]}
              >
                <AntInput.Password placeholder="At least 8 characters" autoComplete="new-password" />
              </AppForm.Item>
            </>
          )}

          <div className="mt-2 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-0">Active</p>
              <p className="text-xs text-gray-500 mb-0">Inactive users cannot log in.</p>
            </div>
            <AppForm.Item name="isActive" valuePropName="checked" className="!mb-0">
              <AntSwitch />
            </AppForm.Item>
          </div>
        </AppForm>
      </AntModal>

      {/* Reset password modal */}
      <AntModal
        title={`Reset password · ${resetTarget?.name ?? ''}`}
        open={!!resetTarget}
        onCancel={closeReset}
        width={420}
        footer={
          resetDone
            ? [
                <AntButton key="ok" type="primary" onClick={closeReset}>
                  Done
                </AntButton>,
              ]
            : [
                <AntButton key="cancel" onClick={closeReset}>
                  Cancel
                </AntButton>,
                <AntButton
                  key="submit"
                  type="primary"
                  loading={resetPw.isPending}
                  onClick={() => resetForm.submit()}
                >
                  Reset Password
                </AntButton>,
              ]
        }
      >
        {resetError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {resetError}
          </div>
        )}
        {resetDone ? (
          <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            Password updated. Share it with {resetTarget?.email} securely — it will not be
            shown again.
          </div>
        ) : (
          <AppForm<{ password: string }>
            form={resetForm}
            onFinish={handleResetFinish}
            initialValues={{ password: '' }}
          >
            <p className="text-sm text-gray-700 mb-3">
              Set a new password for <span className="font-medium">{resetTarget?.email}</span>.
            </p>
            <AppForm.Item
              label="New Password"
              name="password"
              rules={[
                { required: true, message: 'Password is required' },
                { min: 8, message: 'At least 8 characters' },
              ]}
            >
              <AntInput.Password placeholder="At least 8 characters" autoComplete="new-password" />
            </AppForm.Item>
          </AppForm>
        )}
      </AntModal>
    </div>
  );
}
