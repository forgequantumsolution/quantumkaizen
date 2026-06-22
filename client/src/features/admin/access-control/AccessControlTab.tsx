import { useEffect, useMemo, useState } from 'react';
import {
  Button as AntButton,
  Checkbox as AntCheckbox,
  Pagination,
  Select as AntSelect,
  Spin,
} from 'antd';
import {
  Save,
  Lock,
  Search,
  Shield,
  User as UserIcon,
  ChevronRight,
  CheckCircle2,
  LayoutGrid,
} from 'lucide-react';
import {
  useRoles,
  usePermissionsGrouped,
  useSetRolePermissions,
  type Role,
  type Permission,
} from '@/features/admin/roles/hooks';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useHasPermission } from '@/stores/authStore';
import { Input } from '@/components/ui';
import { NAV_ACCESS } from '@/lib/navAccess';
import { cn } from '@/lib/utils';

type View = 'menu' | 'role' | 'user';

const PAGE_SIZE_PERMS = 15;
const PAGE_SIZE_USERS = 20;

/**
 * Permission modules that have no corresponding sidebar item — hidden from the
 * access control UI. When you add a new sidebar item, remove its module key from
 * this set (or add it to the sidebar's nav config to surface here automatically).
 */
const HIDDEN_MODULES = new Set<string>([
  'BUSINESS_CALENDAR',
  'CALIBRATION',
  'FMEA',
  'INSPECTION',
  'RISK',
  'SLA',
  'SUPPLIER',
  'TRAINING',
]);

export default function AccessControlTab() {
  const [view, setView] = useState<View>('role');
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const canEdit = useHasPermission('role.update');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-gray-600 mb-0">
            {canEdit
              ? 'Manage role permissions and view user access. Changes are batched until you save.'
              : 'Read-only view — you do not have permission to edit role permissions.'}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <TopTab
            active={view === 'menu'}
            onClick={() => setView('menu')}
            icon={<LayoutGrid size={13} />}
            label="Menu Access"
          />
          <TopTab
            active={view === 'role'}
            onClick={() => setView('role')}
            icon={<Shield size={13} />}
            label="By Permission"
          />
          <TopTab
            active={view === 'user'}
            onClick={() => setView('user')}
            icon={<UserIcon size={13} />}
            label="By User"
          />
        </div>
      </div>

      {view === 'menu' && <MenuAccessView canEdit={canEdit} />}
      {view === 'role' && (
        <ByRoleView
          canEdit={canEdit}
          pendingRoleId={pendingRoleId}
          onConsumePendingRoleId={() => setPendingRoleId(null)}
        />
      )}
      {view === 'user' && (
        <ByUserView
          onEditRole={(roleId) => {
            setPendingRoleId(roleId);
            setView('role');
          }}
        />
      )}
    </div>
  );
}

/* ── Menu Access view (module → tab matrix per role) ─────────────────── */

interface MenuAccessViewProps {
  canEdit: boolean;
}

function MenuAccessView({ canEdit }: MenuAccessViewProps) {
  const { data: rolesResp, isLoading: rolesLoading } = useRoles({ pageSize: 200 });
  const roles = useMemo(() => rolesResp?.items ?? [], [rolesResp]);
  const { data: permGroups = [], isLoading: permsLoading } = usePermissionsGrouped();
  const setPermissions = useSetRolePermissions();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  // Pending granted permission-id set for the selected role (null = pristine).
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) setSelectedRoleId(roles[0]!.id);
  }, [roles, selectedRoleId]);
  useEffect(() => {
    setDraft(null);
    setSaveError(null);
  }, [selectedRoleId]);

  // permission key → permission id (the role API works on ids).
  const idByKey = useMemo(() => {
    const m = new Map<string, string>();
    permGroups.forEach((g) =>
      g.permissions.forEach((p) => m.set(p.key, p.id)),
    );
    return m;
  }, [permGroups]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  const originalIds = useMemo(
    () => new Set(selectedRole?.permissions.map((p) => p.id) ?? []),
    [selectedRole],
  );
  const granted = draft ?? originalIds;

  const hasKey = (permKey: string): boolean => {
    const id = idByKey.get(permKey);
    return !!id && granted.has(id);
  };

  const setKey = (permKey: string, on: boolean) => {
    const id = idByKey.get(permKey);
    if (!id) return;
    setDraft((prev) => {
      const next = new Set(prev ?? originalIds);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleModuleAll = (moduleKey: string, on: boolean) => {
    const mod = NAV_ACCESS.find((m) => m.key === moduleKey);
    if (!mod) return;
    setDraft((prev) => {
      const next = new Set(prev ?? originalIds);
      mod.tabs.forEach((t) => {
        const id = idByKey.get(t.permission);
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
    if (!selectedRoleId || !draft) return;
    setSaveError(null);
    try {
      await setPermissions.mutateAsync({
        id: selectedRoleId,
        permissionIds: [...draft],
      });
      setDraft(null);
    } catch (err: unknown) {
      setSaveError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Save failed',
      );
    }
  };

  if (rolesLoading || permsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-5">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Role</label>
          <AntSelect
            value={selectedRoleId ?? undefined}
            onChange={(v) => setSelectedRoleId(v)}
            placeholder="Select a role"
            className="w-full"
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
        </div>
        <div className="md:col-span-7 text-[11px] text-gray-500 md:pb-2">
          Choose which <span className="font-medium text-gray-700">modules and tabs</span> this
          role can open. Tabs sharing a permission toggle together.
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs">
          {isDirty ? (
            <span className="text-amber-700 font-medium">Unsaved changes</span>
          ) : (
            <span className="text-gray-400">No pending changes</span>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <AntButton onClick={() => setDraft(null)} disabled={!isDirty}>
              Reset
            </AntButton>
            <AntButton
              type="primary"
              icon={<Save size={14} />}
              onClick={save}
              loading={setPermissions.isPending}
              disabled={!isDirty}
            >
              Save Changes
            </AntButton>
          </div>
        )}
      </div>

      {saveError && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Module → tab matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {NAV_ACCESS.map((mod) => {
          const allOn = mod.tabs.every((t) => hasKey(t.permission));
          return (
            <div key={mod.key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{mod.label}</div>
                  {mod.description && (
                    <div className="text-[11px] text-gray-500 truncate">{mod.description}</div>
                  )}
                </div>
                {canEdit && (
                  <AntButton
                    type="link"
                    size="small"
                    onClick={() => toggleModuleAll(mod.key, !allOn)}
                  >
                    {allOn ? 'Clear all' : 'Select all'}
                  </AntButton>
                )}
              </div>
              <ul className="divide-y divide-gray-50">
                {mod.tabs.map((t) => {
                  const checked = hasKey(t.permission);
                  const missing = !idByKey.has(t.permission);
                  return (
                    <li key={t.key} className="flex items-center gap-3 px-4 py-2.5">
                      <AntCheckbox
                        checked={checked}
                        disabled={!canEdit || !selectedRoleId || missing}
                        onChange={(e) => setKey(t.permission, e.target.checked)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-gray-800">{t.label}</div>
                        <div className="font-mono text-[10px] text-gray-400">{t.permission}</div>
                      </div>
                      {missing && (
                        <span className="text-[10px] text-amber-600">unknown key</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── By-Role view ────────────────────────────────────────────────────── */

interface ByRoleViewProps {
  canEdit: boolean;
  pendingRoleId: string | null;
  onConsumePendingRoleId: () => void;
}

function ByRoleView({ canEdit, pendingRoleId, onConsumePendingRoleId }: ByRoleViewProps) {
  const { data: rolesResp, isLoading: rolesLoading } = useRoles({ pageSize: 200 });
  const roles = useMemo(() => rolesResp?.items ?? [], [rolesResp]);
  const { data: permGroupsRaw = [], isLoading: permsLoading } = usePermissionsGrouped();
  const permGroups = useMemo(
    () => permGroupsRaw.filter((g) => !HIDDEN_MODULES.has(g.module)),
    [permGroupsRaw],
  );
  const setPermissions = useSetRolePermissions();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState<Map<string, Set<string>>>(new Map());
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingRoleId && roles.some((r) => r.id === pendingRoleId)) {
      setSelectedRoleId(pendingRoleId);
      onConsumePendingRoleId();
      return;
    }
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0]!.id);
    }
  }, [roles, selectedRoleId, pendingRoleId, onConsumePendingRoleId]);

  useEffect(() => {
    setPage(1);
  }, [selectedRoleId, selectedModule, search]);

  const initialMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    roles.forEach((r) => m.set(r.id, new Set(r.permissions.map((p) => p.id))));
    return m;
  }, [roles]);

  const effectiveSet = (roleId: string): Set<string> =>
    edits.get(roleId) ?? initialMap.get(roleId) ?? new Set();

  const toggle = (roleId: string, permId: string) => {
    setEdits((prev) => {
      const next = new Map(prev);
      const current = new Set(effectiveSet(roleId));
      if (current.has(permId)) current.delete(permId);
      else current.add(permId);
      next.set(roleId, current);
      return next;
    });
  };

  const dirtyRoleIds = useMemo(() => {
    const ids: string[] = [];
    edits.forEach((set, roleId) => {
      const original = initialMap.get(roleId) ?? new Set();
      const sameSize = set.size === original.size;
      const sameContent = sameSize && [...set].every((id) => original.has(id));
      if (!sameContent) ids.push(roleId);
    });
    return ids;
  }, [edits, initialMap]);

  const isDirty = dirtyRoleIds.length > 0;

  const saveAll = async () => {
    setSaveError(null);
    try {
      await Promise.all(
        dirtyRoleIds.map((roleId) =>
          setPermissions.mutateAsync({
            id: roleId,
            permissionIds: [...(edits.get(roleId) ?? [])],
          }),
        ),
      );
      setEdits(new Map());
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Save failed';
      setSaveError(message);
    }
  };

  const reset = () => {
    setEdits(new Map());
    setSaveError(null);
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  // Flatten + filter permissions
  const allPerms = useMemo(() => {
    const flat: Array<Permission & { module: string }> = [];
    permGroups.forEach((g) => {
      g.permissions.forEach((p) => flat.push({ ...p, module: g.module }));
    });
    return flat;
  }, [permGroups]);

  const filteredPerms = useMemo(() => {
    let list = allPerms;
    if (selectedModule !== 'all') {
      list = list.filter((p) => p.module === selectedModule);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.key.toLowerCase().includes(q) ||
          p.action.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [allPerms, selectedModule, search]);

  const pageStart = (page - 1) * PAGE_SIZE_PERMS;
  const pagePerms = filteredPerms.slice(pageStart, pageStart + PAGE_SIZE_PERMS);

  // Count permissions in selected role
  const roleGrantedCount = selectedRoleId
    ? effectiveSet(selectedRoleId).size
    : 0;

  if (rolesLoading || permsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-4">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Role
          </label>
          <AntSelect
            value={selectedRoleId ?? undefined}
            onChange={(v) => setSelectedRoleId(v)}
            placeholder="Select a role"
            className="w-full"
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
        </div>
        <div className="md:col-span-3">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Module
          </label>
          <AntSelect
            value={selectedModule}
            onChange={(v) => setSelectedModule(v)}
            className="w-full"
            options={[
              { value: 'all', label: 'All modules' },
              ...permGroups.map((g) => ({ value: g.module, label: g.module })),
            ]}
          />
        </div>
        <div className="md:col-span-5">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Search permissions
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            />
            <Input
              placeholder="Search by key, action or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Role summary */}
      {selectedRole && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Shield size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
                {selectedRole.name}
                {selectedRole.isSystem && (
                  <span
                    title="System-protected role"
                    className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                  >
                    <Lock size={10} />
                    System
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-500 truncate">
                {selectedRole.description ?? 'No description'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-[11px] text-gray-600">
            <span>
              <span className="font-semibold text-gray-900">{roleGrantedCount}</span>{' '}
              of {allPerms.length} permissions granted
            </span>
            <span className="text-gray-300">·</span>
            <span>
              <span className="font-semibold text-gray-900">
                {selectedRole._count?.users ?? 0}
              </span>{' '}
              user{selectedRole._count?.users === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      )}

      {/* Dirty banner / save bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs">
          {isDirty ? (
            <span className="text-amber-700">
              <span className="font-semibold">{dirtyRoleIds.length}</span> role(s)
              modified — unsaved changes
            </span>
          ) : (
            <span className="text-gray-400">No pending changes</span>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <AntButton onClick={reset} disabled={!isDirty}>
              Reset
            </AntButton>
            <AntButton
              type="primary"
              icon={<Save size={14} />}
              onClick={saveAll}
              loading={setPermissions.isPending}
              disabled={!isDirty}
            >
              Save Changes
            </AntButton>
          </div>
        )}
      </div>

      {saveError && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Permission list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {pagePerms.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No permissions match your filters.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pagePerms.map((perm) => {
              const checked = selectedRoleId
                ? effectiveSet(selectedRoleId).has(perm.id)
                : false;
              const original = selectedRoleId
                ? initialMap.get(selectedRoleId)?.has(perm.id) ?? false
                : false;
              const dirty = checked !== original;
              return (
                <li
                  key={perm.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors',
                    dirty && 'bg-amber-50/40',
                  )}
                >
                  <AntCheckbox
                    checked={checked}
                    disabled={!canEdit || !selectedRoleId}
                    onChange={() =>
                      selectedRoleId && toggle(selectedRoleId, perm.id)
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[12px] font-semibold text-slate-800">
                        {perm.key}
                      </span>
                      <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                        {perm.module}
                      </span>
                      {dirty && (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Modified
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                      {perm.description}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {filteredPerms.length > PAGE_SIZE_PERMS && (
        <div className="flex items-center justify-between gap-3 text-[11px] text-gray-500 pt-1">
          <span>
            Showing {pageStart + 1}–
            {Math.min(pageStart + PAGE_SIZE_PERMS, filteredPerms.length)} of{' '}
            {filteredPerms.length} permissions
          </span>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE_PERMS}
            total={filteredPerms.length}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
            simple
          />
        </div>
      )}
    </div>
  );
}

/* ── By-User view ─────────────────────────────────────────────────────── */

interface ByUserViewProps {
  onEditRole: (roleId: string) => void;
}

function ByUserView({ onEditRole }: ByUserViewProps) {
  const { data: rolesResp } = useRoles({ pageSize: 200 });
  const roles = rolesResp?.items ?? [];
  const { data: deptsResp } = useDepartments({ pageSize: 200 });
  const departments = deptsResp?.items ?? [];

  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState<string | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, roleId, departmentId]);

  const { data: usersResp, isLoading } = useAdminUsers({
    search: search || undefined,
    roleId,
    departmentId,
    page,
    pageSize: PAGE_SIZE_USERS,
  });
  const users = usersResp?.items ?? [];
  const total = usersResp?.total ?? 0;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Cache of role → permissions for quick lookup
  const roleById = useMemo(() => {
    const m = new Map<string, Role>();
    roles.forEach((r) => m.set(r.id, r));
    return m;
  }, [roles]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-5">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Search user
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="md:col-span-3">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Role
          </label>
          <AntSelect
            value={roleId}
            onChange={(v) => setRoleId(v)}
            placeholder="Any role"
            allowClear
            className="w-full"
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />
        </div>
        <div className="md:col-span-4">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Department
          </label>
          <AntSelect
            value={departmentId}
            onChange={(v) => setDepartmentId(v)}
            placeholder="Any department"
            allowClear
            className="w-full"
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center">
            <Spin />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No users match your filters.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map((u) => {
              const role = u.roleId ? roleById.get(u.roleId) : null;
              const isOpen = expandedId === u.id;
              const permCount = role?.permissions.length ?? 0;
              return (
                <li key={u.id} className="bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : u.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold shrink-0">
                      {(u.name ?? u.email)
                        .split(' ')
                        .map((s) => s[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {u.name ?? u.email}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {u.email}
                        {u.department?.name && (
                          <>
                            <span className="mx-1 text-gray-300">·</span>
                            {u.department.name}
                          </>
                        )}
                      </div>
                    </div>
                    {role ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shrink-0">
                        <Shield size={10} />
                        {role.name}
                        {role.isSystem && <Lock size={9} className="text-blue-400" />}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">No role</span>
                    )}
                    <span className="text-[11px] text-gray-500 shrink-0 hidden sm:inline">
                      {permCount} permission{permCount === 1 ? '' : 's'}
                    </span>
                    <ChevronRight
                      size={14}
                      className={cn(
                        'text-gray-400 shrink-0 transition-transform',
                        isOpen && 'rotate-90',
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50">
                      {role ? (
                        <UserRolePanel
                          role={role}
                          onEditRole={() => {
                            onEditRole(role.id);
                          }}
                        />
                      ) : (
                        <div className="py-2 text-xs text-gray-500 italic">
                          This user has no role assigned.
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {total > PAGE_SIZE_USERS && (
        <div className="flex items-center justify-between gap-3 text-[11px] text-gray-500 pt-1">
          <span>
            Showing {(page - 1) * PAGE_SIZE_USERS + 1}–
            {Math.min(page * PAGE_SIZE_USERS, total)} of {total} users
          </span>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE_USERS}
            total={total}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
            simple
          />
        </div>
      )}
    </div>
  );
}

interface UserRolePanelProps {
  role: Role;
  onEditRole: () => void;
}

function UserRolePanel({ role, onEditRole }: UserRolePanelProps) {
  // Group the role's permissions by module (filter out non-sidebar modules)
  const grouped = useMemo(() => {
    const m = new Map<string, Permission[]>();
    role.permissions.forEach((p) => {
      if (HIDDEN_MODULES.has(p.module)) return;
      const arr = m.get(p.module) ?? [];
      arr.push(p);
      m.set(p.module, arr);
    });
    return Array.from(m.entries())
      .map(([module, perms]) => ({ module, perms }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [role]);

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-gray-600">
          Effective permissions inherited from{' '}
          <span className="font-semibold text-gray-900">{role.name}</span>
        </div>
        <AntButton size="small" onClick={onEditRole}>
          Edit role permissions
        </AntButton>
      </div>

      {grouped.length === 0 ? (
        <div className="text-xs text-gray-400 italic">
          This role has no permissions granted.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {grouped.map((g) => (
            <div
              key={g.module}
              className="rounded-lg border border-gray-200 bg-white p-2.5"
            >
              <div className="text-[10px] font-mono font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                {g.module}
              </div>
              <ul className="space-y-1">
                {g.perms.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start gap-1.5 text-[12px] text-gray-700"
                  >
                    <CheckCircle2
                      size={12}
                      className="text-emerald-500 mt-0.5 shrink-0"
                    />
                    <span className="font-mono">{p.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Small helpers ───────────────────────────────────────────────────── */

interface TopTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TopTab({ active, onClick, icon, label }: TopTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
