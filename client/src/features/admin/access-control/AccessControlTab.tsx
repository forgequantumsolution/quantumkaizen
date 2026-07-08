import { useEffect, useMemo, useState } from 'react';
import { Button as AntButton, Select as AntSelect, Input as AntInput, Pagination, Spin } from 'antd';
import { Save, Shield, Building2, User as UserIcon, LayoutGrid, BarChart3, Lock, Search } from 'lucide-react';
import {
  useRoles,
  usePermissionsGrouped,
  useSetRolePermissions,
} from '@/features/admin/roles/hooks';
import { useAdminUsers, type AdminUser } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import {
  useDepartmentPermissions,
  useSetDepartmentPermissions,
  useUserPermissions,
  useSetUserPermissions,
  type UserOverrideInput,
} from './hooks';
import { useHasPermission, useAuthStore } from '@/stores/authStore';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';
import AccessMatrix, { type TriState } from './AccessMatrix';
import AccessAnalysisView from './AccessAnalysisView';
import type { CatalogPerm } from '@/lib/accessActions';
import {
  type NavModuleAccess,
  isAuditWorkflowTypeName,
  workflowTypeModule,
} from '@/lib/navAccess';
import { cn } from '@/lib/utils';

type TopView = 'matrix' | 'analysis';
type Subject = 'role' | 'department' | 'user';

/* Shared: one Access-Control module per (non-Audit, live) workflow type, so
 * each module gets its own switch. Appended after the static NAV_ACCESS list. */
function useWorkflowTypeModules(): NavModuleAccess[] {
  const { data: types = [] } = useWorkflowTypes();
  return useMemo(
    () =>
      types
        .filter((t) => !t.isDeleted && !isAuditWorkflowTypeName(t.name))
        .map((t) => workflowTypeModule(t)),
    [types],
  );
}

/* Shared: flatten the grouped catalog into a key→id map + a CatalogPerm list. */
function useCatalog() {
  const { data: permGroups = [], isLoading } = usePermissionsGrouped();
  return useMemo(() => {
    const catalog: CatalogPerm[] = [];
    const idByKey = new Map<string, string>();
    permGroups.forEach((g) =>
      g.permissions.forEach((p) => {
        catalog.push({ key: p.key, action: p.action, description: p.description });
        idByKey.set(p.key, p.id);
      }),
    );
    return { catalog, idByKey, isLoading };
  }, [permGroups, isLoading]);
}

export default function AccessControlTab() {
  const [view, setView] = useState<TopView>('matrix');
  const [subject, setSubject] = useState<Subject>('role');

  return (
    <div className="space-y-2.5">
      {/* One compact control row: subject switcher (left) + view switcher (right). */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {view === 'matrix' ? (
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            <SubjectTab active={subject === 'role'} onClick={() => setSubject('role')} icon={<Shield size={13} />} label="Role" />
            <SubjectTab active={subject === 'department'} onClick={() => setSubject('department')} icon={<Building2 size={13} />} label="Department" />
            <SubjectTab active={subject === 'user'} onClick={() => setSubject('user')} icon={<UserIcon size={13} />} label="User" />
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-800">Access Analysis</span>
        )}
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <TopTab active={view === 'matrix'} onClick={() => setView('matrix')} icon={<LayoutGrid size={13} />} label="Access Matrix" />
          <TopTab active={view === 'analysis'} onClick={() => setView('analysis')} icon={<BarChart3 size={13} />} label="Access Analysis" />
        </div>
      </div>

      {view === 'matrix' && (
        <>
          {subject === 'role' && <RoleSubject />}
          {subject === 'department' && <DepartmentSubject />}
          {subject === 'user' && <UserSubject />}
        </>
      )}

      {view === 'analysis' && <AccessAnalysisView />}
    </div>
  );
}

/* ── Role subject (binary) ────────────────────────────────────────────── */
function RoleSubject() {
  const canEdit = useHasPermission('role.update');
  const { catalog, idByKey, isLoading: catalogLoading } = useCatalog();
  const extraModules = useWorkflowTypeModules();
  const { data: rolesResp, isLoading: rolesLoading } = useRoles({ pageSize: 200 });
  const roles = useMemo(() => rolesResp?.items ?? [], [rolesResp]);
  const setPermissions = useSetRolePermissions();

  const [roleId, setRoleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [search, setSearch] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!roleId && roles.length > 0) setRoleId(roles[0]!.id);
  }, [roles, roleId]);
  useEffect(() => {
    setDraft(null);
    setSaveError(null);
  }, [roleId]);

  const role = roles.find((r) => r.id === roleId) ?? null;
  const originalIds = useMemo(() => new Set(role?.permissions.map((p) => p.id) ?? []), [role]);
  const granted = draft ?? originalIds;

  const isOn = (key: string) => {
    const id = idByKey.get(key);
    return !!id && granted.has(id);
  };
  const setKeys = (updates: { key: string; on: boolean }[]) => {
    setDraft((prev) => {
      const next = new Set(prev ?? originalIds);
      updates.forEach(({ key, on }) => {
        const id = idByKey.get(key);
        if (!id) return;
        if (on) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const isDirty = useMemo(() => {
    if (!draft) return false;
    if (draft.size !== originalIds.size) return true;
    for (const id of draft) if (!originalIds.has(id)) return true;
    return false;
  }, [draft, originalIds]);

  const save = async () => {
    if (!roleId || !draft) return;
    setSaveError(null);
    try {
      await setPermissions.mutateAsync({ id: roleId, permissionIds: [...draft] });
      setDraft(null);
      // If this role belongs to the logged-in user, refresh their permissions so
      // the sidebar/gates reflect the change without a re-login.
      await useAuthStore.getState().refreshUser();
    } catch (err) {
      setSaveError(extractError(err));
    }
  };

  if (rolesLoading || catalogLoading) return <Loading />;

  return (
    <div className="space-y-3">
      {saveError && <ErrorBanner message={saveError} />}
      <AccessMatrix
        mode="binary"
        catalog={catalog}
        extraModules={extraModules}
        canEdit={canEdit && !!roleId}
        search={search}
        onSearchChange={setSearch}
        isOn={isOn}
        setKeys={setKeys}
        leftSlot={
          <div className="flex items-center gap-2">
            <AntSelect
              value={roleId ?? undefined}
              onChange={setRoleId}
              placeholder="Select a role"
              className="w-52"
              options={roles.map((r) => ({
                value: r.id,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {r.name}
                    {r.isSystem && <Lock size={10} className="text-gray-400" />}
                  </span>
                ),
              }))}
            />
            {role && (
              <span className="text-[11px] text-gray-500 whitespace-nowrap hidden xl:inline">
                {granted.size} perms · {role._count?.users ?? 0} users
              </span>
            )}
          </div>
        }
        rightSlot={
          <SaveControls
            canEdit={canEdit}
            isDirty={isDirty}
            saving={setPermissions.isPending}
            onReset={() => setDraft(null)}
            onSave={save}
            readOnlyHint="Read-only — no role.update"
          />
        }
      />
    </div>
  );
}

/* ── Department subject (binary) ──────────────────────────────────────── */
function DepartmentSubject() {
  const canEdit = useHasPermission('department.update');
  const { catalog, idByKey, isLoading: catalogLoading } = useCatalog();
  const extraModules = useWorkflowTypeModules();
  const { data: deptsResp, isLoading: deptsLoading } = useDepartments({ pageSize: 200 });
  const departments = useMemo(() => deptsResp?.items ?? [], [deptsResp]);

  const [deptId, setDeptId] = useState<string | null>(null);
  const { data: deptPerms = [], isLoading: permsLoading } = useDepartmentPermissions(deptId);
  const setDeptPermissions = useSetDepartmentPermissions();

  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [search, setSearch] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!deptId && departments.length > 0) setDeptId(departments[0]!.id);
  }, [departments, deptId]);
  useEffect(() => {
    setDraft(null);
    setSaveError(null);
  }, [deptId]);

  // When draft is null, `granted` derives live from the fetched permissions, so
  // no reset-on-load effect is needed (and adding one would wipe unsaved edits
  // on a background refetch).
  const originalIds = useMemo(() => new Set(deptPerms.map((p) => p.id)), [deptPerms]);

  const granted = draft ?? originalIds;
  const isOn = (key: string) => {
    const id = idByKey.get(key);
    return !!id && granted.has(id);
  };
  const setKeys = (updates: { key: string; on: boolean }[]) => {
    setDraft((prev) => {
      const next = new Set(prev ?? originalIds);
      updates.forEach(({ key, on }) => {
        const id = idByKey.get(key);
        if (!id) return;
        if (on) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const isDirty = useMemo(() => {
    if (!draft) return false;
    if (draft.size !== originalIds.size) return true;
    for (const id of draft) if (!originalIds.has(id)) return true;
    return false;
  }, [draft, originalIds]);

  const save = async () => {
    if (!deptId || !draft) return;
    setSaveError(null);
    try {
      await setDeptPermissions.mutateAsync({ id: deptId, permissionIds: [...draft] });
      setDraft(null);
      // Refresh in case the edited department is the logged-in user's own.
      await useAuthStore.getState().refreshUser();
    } catch (err) {
      setSaveError(extractError(err));
    }
  };

  if (deptsLoading || catalogLoading) return <Loading />;

  return (
    <div className="space-y-3">
      <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-[12px] text-blue-800">
        Department grants are <span className="font-semibold">additive</span> — a user gets these in
        addition to their role. Departments can only grant (never deny).
      </div>
      {saveError && <ErrorBanner message={saveError} />}
      <AccessMatrix
        mode="binary"
        catalog={catalog}
        extraModules={extraModules}
        canEdit={canEdit && !!deptId}
        search={search}
        onSearchChange={setSearch}
        isOn={isOn}
        setKeys={setKeys}
        leftSlot={
          <div className="flex items-center gap-2">
            <AntSelect
              value={deptId ?? undefined}
              onChange={setDeptId}
              placeholder="Select a department"
              className="w-52"
              options={departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
            />
            <span className="text-[11px] text-gray-500 whitespace-nowrap hidden xl:inline">
              {permsLoading ? 'Loading…' : `${granted.size} granted`}
            </span>
          </div>
        }
        rightSlot={
          <SaveControls
            canEdit={canEdit}
            isDirty={isDirty}
            saving={setDeptPermissions.isPending}
            onReset={() => setDraft(null)}
            onSave={save}
            readOnlyHint="Read-only — no department.update"
          />
        }
      />
    </div>
  );
}

/* ── User subject (tri-state overrides) ───────────────────────────────── */
function UserSubject() {
  const canEdit = useHasPermission('user.update');
  const { catalog, idByKey, isLoading: catalogLoading } = useCatalog();
  const extraModules = useWorkflowTypeModules();

  // Backend-paginated user picker — 10 users per page (search + pager on the API).
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const { data: usersResp, isLoading: usersLoading } = useAdminUsers({
    search: userSearch || undefined,
    page: userPage,
    pageSize: 10,
  });
  const users = useMemo(() => usersResp?.items ?? [], [usersResp]);
  const usersTotal = usersResp?.total ?? 0;

  // Debounce the picker search and reset to page 1 on a new query.
  useEffect(() => {
    const t = setTimeout(() => {
      setUserSearch(userSearchInput.trim());
      setUserPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [userSearchInput]);

  const [userId, setUserId] = useState<string | null>(null);
  // Keep the chosen user object so labels/summary survive paging away from it.
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const { data: perms, isLoading: permsLoading } = useUserPermissions(userId);
  const setUserPermissions = useSetUserPermissions();

  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  // Draft override map: key → 'GRANT' | 'DENY'. null = pristine (== baseline).
  const [draft, setDraft] = useState<Map<string, 'GRANT' | 'DENY'> | null>(null);

  useEffect(() => {
    if (!userId && users.length > 0) {
      setUserId(users[0]!.id);
      setSelectedUser(users[0]!);
    }
  }, [users, userId]);
  useEffect(() => {
    setDraft(null);
    setReason('');
    setSaveError(null);
  }, [userId]);
  // No reset-on-`perms` effect: while draft is null, `overrides` derives live
  // from the fetched baseline, so a background refetch won't clobber edits.

  const baseline = useMemo(() => {
    const m = new Map<string, 'GRANT' | 'DENY'>();
    perms?.sources.grants.forEach((k) => m.set(k, 'GRANT'));
    perms?.sources.denies.forEach((k) => m.set(k, 'DENY'));
    return m;
  }, [perms]);

  const overrides = draft ?? baseline;

  const inheritedSet = useMemo(() => {
    const s = new Set<string>();
    perms?.sources.role.forEach((k) => s.add(k));
    perms?.sources.department.forEach((k) => s.add(k));
    return s;
  }, [perms]);

  const triStateOf = (key: string): TriState => {
    const o = overrides.get(key);
    if (o === 'GRANT') return 'grant';
    if (o === 'DENY') return 'deny';
    return 'none';
  };
  const isInherited = (key: string) => inheritedSet.has(key);
  const setTri = (key: string, next: TriState) => {
    setDraft((prev) => {
      const map = new Map(prev ?? baseline);
      if (next === 'none') map.delete(key);
      else map.set(key, next === 'grant' ? 'GRANT' : 'DENY');
      return map;
    });
  };
  const sourceLabel = (key: string): string => {
    const o = overrides.get(key);
    if (o === 'GRANT') return 'Explicit grant';
    if (o === 'DENY') return 'Explicit deny — overrides inherited access';
    if (perms?.sources.role.includes(key)) return `via ${selectedUser?.role?.name ?? 'role'} role`;
    if (perms?.sources.department.includes(key))
      return `via ${selectedUser?.department?.name ?? 'department'} department`;
    return 'No access';
  };

  const isDirty = useMemo(() => {
    if (!draft) return false;
    if (draft.size !== baseline.size) return true;
    for (const [k, v] of draft) if (baseline.get(k) !== v) return true;
    return false;
  }, [draft, baseline]);

  const save = async () => {
    if (!userId || !draft) return;
    setSaveError(null);
    const overridesPayload: UserOverrideInput[] = [];
    for (const [key, effect] of draft) {
      const id = idByKey.get(key);
      if (!id) continue;
      overridesPayload.push({ permissionId: id, effect, reason: reason || undefined });
    }
    try {
      await setUserPermissions.mutateAsync({ id: userId, overrides: overridesPayload });
      setDraft(null);
      setReason('');
      // Refresh in case these overrides target the logged-in user themselves.
      await useAuthStore.getState().refreshUser();
    } catch (err) {
      setSaveError(extractError(err));
    }
  };

  // Only gate on the catalog — the user picker shows its own paging spinner, so
  // navigating pages must not blank the whole panel.
  if (catalogLoading) return <Loading />;

  const grantCount = [...overrides.values()].filter((v) => v === 'GRANT').length;
  const denyCount = [...overrides.values()].filter((v) => v === 'DENY').length;

  return (
    <div className="space-y-3">
      <UserPicker
        users={users}
        total={usersTotal}
        page={userPage}
        onPage={setUserPage}
        loading={usersLoading}
        searchInput={userSearchInput}
        onSearchInput={setUserSearchInput}
        selectedId={userId}
        onSelect={(u) => {
          setUserId(u.id);
          setSelectedUser(u);
        }}
      />

      {!userId ? (
        <div className="py-10 text-center text-sm text-gray-400">
          Select a user above to manage their access overrides.
        </div>
      ) : (
        <>
          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12px] text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-gray-100 border border-gray-300" /> Inherited (role / dept)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-600" /> Explicit grant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-50 border border-red-300" /> Explicit deny
            </span>
            <span className="text-slate-400">Click a cell to cycle Inherit → Grant → Deny.</span>
          </div>

          {saveError && <ErrorBanner message={saveError} />}
          <AccessMatrix
            mode="tristate"
            catalog={catalog}
            extraModules={extraModules}
            canEdit={canEdit && !!userId}
            search={search}
            onSearchChange={setSearch}
            triStateOf={triStateOf}
            isInherited={isInherited}
            setTri={setTri}
            sourceLabel={sourceLabel}
            leftSlot={
              <div className="min-w-0 max-w-[200px]">
                <div className="text-[13px] font-semibold text-gray-900 truncate">
                  {selectedUser?.name ?? selectedUser?.email ?? '—'}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {permsLoading ? 'Loading…' : `${grantCount} grants · ${denyCount} denies`}
                </div>
              </div>
            }
            rightSlot={
              <>
                {canEdit && isDirty && (
                  <AntInput
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (GxP)…"
                    className="w-40"
                  />
                )}
                <SaveControls
                  canEdit={canEdit}
                  isDirty={isDirty}
                  saving={setUserPermissions.isPending}
                  onReset={() => {
                    setDraft(null);
                    setReason('');
                  }}
                  onSave={save}
                  readOnlyHint="Read-only — no user.update"
                />
              </>
            }
          />
        </>
      )}
    </div>
  );
}

/* ── Backend-paginated user picker (10 / page) ────────────────────────── */
interface UserPickerProps {
  users: AdminUser[];
  total: number;
  page: number;
  onPage: (p: number) => void;
  loading: boolean;
  searchInput: string;
  onSearchInput: (s: string) => void;
  selectedId: string | null;
  onSelect: (u: AdminUser) => void;
}
function UserPicker({
  users,
  total,
  page,
  onPage,
  loading,
  searchInput,
  onSearchInput,
  selectedId,
  onSelect,
}: UserPickerProps) {
  const initials = (u: AdminUser) =>
    (u.name ?? u.email)
      .split(' ')
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <AntInput
          value={searchInput}
          onChange={(e) => onSearchInput(e.target.value)}
          placeholder="Search users by name or email…"
          allowClear
          prefix={<Search size={14} className="text-gray-400" />}
        />
      </div>
      {loading ? (
        <div className="py-10 text-center">
          <Spin />
        </div>
      ) : users.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">No users match your search.</div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {users.map((u) => {
            const active = u.id === selectedId;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onSelect(u)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    active ? 'bg-blue-50' : 'hover:bg-gray-50',
                  )}
                >
                  <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-semibold shrink-0">
                    {initials(u)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-gray-900 truncate">
                      {u.name ?? u.email}
                    </span>
                    <span className="block text-[11px] text-gray-500 truncate">
                      {u.email}
                      {u.department?.name ? ` · ${u.department.name}` : ''}
                    </span>
                  </span>
                  {u.role?.name && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shrink-0">
                      <Shield size={10} />
                      {u.role.name}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
        <span className="text-[11px] text-gray-500">
          {total} user{total === 1 ? '' : 's'}
        </span>
        <Pagination
          current={page}
          pageSize={10}
          total={total}
          onChange={onPage}
          showSizeChanger={false}
          simple
          size="small"
        />
      </div>
    </div>
  );
}

/* ── shared UI ────────────────────────────────────────────────────────── */
interface SaveControlsProps {
  canEdit: boolean;
  isDirty: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
  readOnlyHint: string;
}
function SaveControls({ canEdit, isDirty, saving, onReset, onSave, readOnlyHint }: SaveControlsProps) {
  if (!canEdit) {
    return <span className="text-[11px] text-gray-400 whitespace-nowrap">{readOnlyHint}</span>;
  }
  return (
    <>
      {isDirty && (
        <span className="text-[11px] text-amber-700 font-medium whitespace-nowrap hidden md:inline">
          Unsaved
        </span>
      )}
      <AntButton onClick={onReset} disabled={!isDirty}>
        Reset
      </AntButton>
      <AntButton
        type="primary"
        icon={<Save size={14} />}
        onClick={onSave}
        loading={saving}
        disabled={!isDirty}
      >
        Save
      </AntButton>
    </>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spin />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{message}</div>
  );
}

function extractError(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    'Save failed'
  );
}

interface TabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}
function TopTab({ active, onClick, icon, label }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
function SubjectTab({ active, onClick, icon, label }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition-colors',
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
