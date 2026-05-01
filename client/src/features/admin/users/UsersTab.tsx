import { useMemo, useState } from 'react';
import { Formik, Form, type FormikHelpers } from 'formik';
import * as Yup from 'yup';
import {
  Button as AntButton,
  Modal as AntModal,
  Input as AntInput,
  Select as AntSelect,
  Switch as AntSwitch,
  Table as AntTable,
  Tag as AntTag,
  DatePicker as AntDatePicker,
  Form as AntForm,
  Empty,
  Avatar as AntAvatar,
  type TableColumnsType,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Plus, Pencil, KeyRound, Power, RotateCcw } from 'lucide-react';
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

const buildSchema = (isEditing: boolean) =>
  Yup.object({
    email: Yup.string().email('Enter a valid email').required('Email is required'),
    password: isEditing
      ? Yup.string().notRequired()
      : Yup.string().min(8, 'At least 8 characters').required('Password is required'),
    employeeId: Yup.string()
      .matches(/^[A-Z0-9_-]{2,32}$/, 'Employee ID: 2–32 chars A-Z 0-9 _ -')
      .nullable()
      .notRequired(),
    firstName: Yup.string().max(60).nullable(),
    lastName: Yup.string().max(60).nullable(),
    phone: Yup.string().max(40).nullable(),
    designation: Yup.string().max(120).nullable(),
    departmentId: Yup.string().nullable(),
    roleId: Yup.string().nullable(),
    managerId: Yup.string().nullable(),
    joinDate: Yup.mixed().nullable(),
    isActive: Yup.boolean().required(),
  }).test('name-required', 'Provide at least a first or last name', function (v) {
    if (!v.firstName && !v.lastName) {
      return this.createError({
        path: 'firstName',
        message: 'Provide at least a first or last name',
      });
    }
    return true;
  });

const passwordSchema = Yup.object({
  password: Yup.string().min(8, 'At least 8 characters').required('Password is required'),
});

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

export default function UsersTab() {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      departmentId: departmentFilter || undefined,
      roleId: roleFilter || undefined,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
    }),
    [search, departmentFilter, roleFilter, statusFilter],
  );

  const { data: usersResponse, isLoading } = useAdminUsers(filters);
  const users = usersResponse?.items ?? [];
  const { data: departments = [] } = useDepartments({ isActive: true });
  const { data: roles = [] } = useRoles();
  const { data: managerPool } = useAdminUsers({ isActive: true });

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
  };

  const handleSubmit = async (values: FormValues, helpers: FormikHelpers<FormValues>) => {
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
    } finally {
      helpers.setSubmitting(false);
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
          pagination={false}
          rowClassName={(record) => (!record.isActive ? 'opacity-60' : '')}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No users found" />,
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
        {({ values, errors, touched, setFieldValue, handleSubmit, isSubmitting, resetForm }) => (
          <AntModal
            title={editing ? `Edit User · ${editing.name}` : 'Add User'}
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
                {editing ? 'Save Changes' : 'Create User'}
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

              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Identity
              </h3>
              <div className="grid grid-cols-2 gap-x-4">
                <AntForm.Item
                  label="Employee ID"
                  validateStatus={touched.employeeId && errors.employeeId ? 'error' : ''}
                  help={touched.employeeId && errors.employeeId}
                >
                  <AntInput
                    value={values.employeeId}
                    onChange={(e) => setFieldValue('employeeId', e.target.value.toUpperCase())}
                    placeholder="EMP-001"
                    maxLength={32}
                  />
                </AntForm.Item>
                <AntForm.Item
                  label="Email"
                  required
                  validateStatus={touched.email && errors.email ? 'error' : ''}
                  help={touched.email && errors.email}
                >
                  <AntInput
                    type="email"
                    value={values.email}
                    onChange={(e) => setFieldValue('email', e.target.value)}
                    placeholder="user@company.com"
                    disabled={!!editing}
                  />
                </AntForm.Item>
                <AntForm.Item
                  label="First Name"
                  validateStatus={touched.firstName && errors.firstName ? 'error' : ''}
                  help={touched.firstName && errors.firstName}
                >
                  <AntInput
                    value={values.firstName}
                    onChange={(e) => setFieldValue('firstName', e.target.value)}
                    placeholder="Priya"
                  />
                </AntForm.Item>
                <AntForm.Item label="Last Name">
                  <AntInput
                    value={values.lastName}
                    onChange={(e) => setFieldValue('lastName', e.target.value)}
                    placeholder="Sharma"
                  />
                </AntForm.Item>
                <AntForm.Item label="Phone">
                  <AntInput
                    value={values.phone}
                    onChange={(e) => setFieldValue('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </AntForm.Item>
                <AntForm.Item label="Designation">
                  <AntInput
                    value={values.designation}
                    onChange={(e) => setFieldValue('designation', e.target.value)}
                    placeholder="Senior Quality Engineer"
                  />
                </AntForm.Item>
              </div>

              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-2">
                Organization
              </h3>
              <div className="grid grid-cols-2 gap-x-4">
                <AntForm.Item label="Department">
                  <AntSelect
                    value={values.departmentId || undefined}
                    onChange={(v) => setFieldValue('departmentId', v ?? '')}
                    placeholder="— None —"
                    allowClear
                    options={departments.map((d) => ({
                      value: d.id,
                      label: `${d.code} · ${d.name}`,
                    }))}
                  />
                </AntForm.Item>
                <AntForm.Item label="Role">
                  <AntSelect
                    value={values.roleId || undefined}
                    onChange={(v) => setFieldValue('roleId', v ?? '')}
                    placeholder="— None —"
                    allowClear
                    options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  />
                </AntForm.Item>
                <AntForm.Item label="Manager">
                  <AntSelect
                    value={values.managerId || undefined}
                    onChange={(v) => setFieldValue('managerId', v ?? '')}
                    placeholder="— None —"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={managerOptions}
                  />
                </AntForm.Item>
                <AntForm.Item label="Join Date">
                  <AntDatePicker
                    value={values.joinDate}
                    onChange={(d) => setFieldValue('joinDate', d)}
                    style={{ width: '100%' }}
                  />
                </AntForm.Item>
              </div>

              {!editing && (
                <>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-2">
                    Initial Password
                  </h3>
                  <AntForm.Item
                    label="Password"
                    required
                    validateStatus={touched.password && errors.password ? 'error' : ''}
                    help={
                      (touched.password && errors.password) ||
                      'The user can change this later from their profile.'
                    }
                  >
                    <AntInput.Password
                      value={values.password}
                      onChange={(e) => setFieldValue('password', e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                  </AntForm.Item>
                </>
              )}

              <AntForm.Item label="Active" className="!mt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 mb-0">Inactive users cannot log in.</p>
                  <AntSwitch
                    checked={values.isActive}
                    onChange={(v) => setFieldValue('isActive', v)}
                  />
                </div>
              </AntForm.Item>
            </Form>
            </AntForm>
          </AntModal>
        )}
      </Formik>

      {/* Reset password modal */}
      <Formik
        initialValues={{ password: '' }}
        validationSchema={passwordSchema}
        enableReinitialize
        onSubmit={async (values, helpers) => {
          if (!resetTarget) return;
          try {
            await resetPw.mutateAsync({ id: resetTarget.id, password: values.password });
            helpers.setStatus({ done: true });
          } catch (err) {
            helpers.setStatus({ error: extractApiError(err, 'Reset failed') });
          } finally {
            helpers.setSubmitting(false);
          }
        }}
      >
        {({ values, errors, touched, status, setFieldValue, handleSubmit, isSubmitting, resetForm }) => {
          const closeReset = () => {
            resetForm();
            setResetTarget(null);
          };
          const done = !!status?.done;
          return (
            <AntModal
              title={`Reset password · ${resetTarget?.name ?? ''}`}
              open={!!resetTarget}
              onCancel={closeReset}
              width={420}
              footer={
                done
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
                        loading={isSubmitting}
                        onClick={() => handleSubmit()}
                      >
                        Reset Password
                      </AntButton>,
                    ]
              }
            >
              {status?.error && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {status.error}
                </div>
              )}
              {done ? (
                <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                  Password updated. Share it with {resetTarget?.email} securely — it will not be
                  shown again.
                </div>
              ) : (
                <AntForm layout="vertical" component={false}>
                  <p className="text-sm text-gray-700 mb-3">
                    Set a new password for <span className="font-medium">{resetTarget?.email}</span>.
                  </p>
                  <AntForm.Item
                    label="New Password"
                    validateStatus={touched.password && errors.password ? 'error' : ''}
                    help={touched.password && errors.password}
                  >
                    <AntInput.Password
                      value={values.password}
                      onChange={(e) => setFieldValue('password', e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                  </AntForm.Item>
                </AntForm>
              )}
            </AntModal>
          );
        }}
      </Formik>
    </div>
  );
}
