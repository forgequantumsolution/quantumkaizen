import { Fragment, useMemo, useState } from 'react';
import { Button as AntButton, Checkbox as AntCheckbox, Spin } from 'antd';
import { Save, Lock } from 'lucide-react';
import {
  useRoles,
  usePermissionsGrouped,
  useSetRolePermissions,
  type Role,
} from '@/features/admin/roles/hooks';
import { useHasPermission } from '@/stores/authStore';
import { cn } from '@/lib/utils';

export default function AccessControlTab() {
  const { data: rolesResp, isLoading: rolesLoading } = useRoles({ pageSize: 200 });
  const roles = rolesResp?.items ?? [];
  const { data: permGroups = [], isLoading: permsLoading } = usePermissionsGrouped();
  const setPermissions = useSetRolePermissions();
  const canEdit = useHasPermission('role.update');

  const initialMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    roles.forEach((r) => m.set(r.id, new Set(r.permissions.map((p) => p.id))));
    return m;
  }, [roles]);

  const [edits, setEdits] = useState<Map<string, Set<string>>>(new Map());
  const [saveError, setSaveError] = useState<string | null>(null);

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

  if (rolesLoading || permsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600 mb-0">
            {canEdit
              ? 'Toggle which permissions each role grants. Changes are batched until you save.'
              : 'Read-only view — you do not have permission to edit role permissions.'}
          </p>
          {isDirty && (
            <p className="text-xs text-amber-600 mt-1 mb-0">
              {dirtyRoleIds.length} role(s) modified — unsaved changes
            </p>
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary border-b border-gray-100">
                <th className="sticky left-0 z-10 bg-surface-secondary px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-64">
                  Permission
                </th>
                {roles.map((role: Role) => (
                  <th
                    key={role.id}
                    className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {role.name}
                      {role.isSystem && <Lock size={10} className="text-gray-400" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permGroups.map((group) => (
                <Fragment key={group.module}>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <td
                      colSpan={1 + roles.length}
                      className="sticky left-0 px-4 py-2 text-xs font-mono font-semibold text-slate-900 bg-gray-50"
                    >
                      {group.module}
                    </td>
                  </tr>
                  {group.permissions.map((perm) => (
                    <tr
                      key={perm.id}
                      className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="sticky left-0 z-10 bg-white hover:bg-blue-50/30 px-4 py-2.5 w-64">
                        <div className="font-mono text-xs font-medium text-slate-900">
                          {perm.action}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">{perm.description}</div>
                      </td>
                      {roles.map((role) => {
                        const checked = effectiveSet(role.id).has(perm.id);
                        const original = initialMap.get(role.id)?.has(perm.id) ?? false;
                        const dirty = checked !== original;
                        return (
                          <td key={role.id} className="px-3 py-2.5 text-center">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-5 h-5 rounded',
                                dirty && 'ring-2 ring-amber-300',
                              )}
                            >
                              <AntCheckbox
                                checked={checked}
                                disabled={!canEdit}
                                onChange={() => toggle(role.id, perm.id)}
                              />
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
