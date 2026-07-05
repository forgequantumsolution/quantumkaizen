/**
 * Effective-permission resolver — the single source of truth for "what can this
 * user do". The guard (`middleware/permissions.ts`), `/auth/login`, and
 * `/auth/me` all call this so they can never drift.
 *
 * Model (docs/ACCESS-CONTROL-enhancement-plan.md §3):
 *   grants  = role.permissions ∪ department.permissions ∪ user GRANT overrides
 *   denies  = user DENY overrides
 *   effective = grants \ denies            (deny wins)
 *
 *   SUPER_ADMIN role → ALL catalog keys, deny ignored (bypass preserved).
 *
 * Department inheritance is intentionally direct-only (user.departmentId, not
 * ancestors) — see §3.3. Adding ancestor inheritance is a localized change here.
 */
import { prisma } from './prisma';
import { PERMISSIONS } from './rbac-catalog';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

/** Every permission key in the code catalog — used for the SUPER_ADMIN bypass. */
export const ALL_KEYS: string[] = PERMISSIONS.map((p) => p.key);

const userSelect = {
  role: { select: { name: true, permissions: { select: { key: true } } } },
  department: { select: { permissions: { select: { key: true } } } },
  permissionOverrides: {
    select: { effect: true, permission: { select: { key: true } } },
  },
} as const;

/**
 * Resolve the flat set of permission keys a user effectively holds.
 * Returns an empty set for an unknown user (denied everything guarded).
 */
export const computeEffectivePermissions = async (userId: string): Promise<Set<string>> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });
  if (!user) return new Set<string>();
  if (user.role?.name === SUPER_ADMIN_ROLE) return new Set(ALL_KEYS); // §3.1 bypass

  const grants = new Set<string>();
  user.role?.permissions.forEach((p) => grants.add(p.key));
  user.department?.permissions.forEach((p) => grants.add(p.key));
  for (const o of user.permissionOverrides) {
    if (o.effect === 'GRANT') grants.add(o.permission.key);
  }
  // Deny wins — applied last so it removes even role/department grants.
  for (const o of user.permissionOverrides) {
    if (o.effect === 'DENY') grants.delete(o.permission.key);
  }
  return grants;
};

export interface EffectiveWithSources {
  effective: string[];
  sources: {
    role: string[];
    department: string[];
    grants: string[];
    denies: string[];
  };
}

/**
 * Same resolution as `computeEffectivePermissions`, but keeps each contributing
 * source so the UI can annotate where every effective bit came from (§6.3).
 * For SUPER_ADMIN the effective set is ALL keys, attributed to the role source.
 */
export const computeEffectiveWithSources = async (
  userId: string,
): Promise<EffectiveWithSources> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });
  if (!user) {
    return { effective: [], sources: { role: [], department: [], grants: [], denies: [] } };
  }

  if (user.role?.name === SUPER_ADMIN_ROLE) {
    return {
      effective: [...ALL_KEYS],
      sources: { role: [...ALL_KEYS], department: [], grants: [], denies: [] },
    };
  }

  const role = (user.role?.permissions ?? []).map((p) => p.key);
  const department = (user.department?.permissions ?? []).map((p) => p.key);
  const grants = user.permissionOverrides
    .filter((o) => o.effect === 'GRANT')
    .map((o) => o.permission.key);
  const denies = user.permissionOverrides
    .filter((o) => o.effect === 'DENY')
    .map((o) => o.permission.key);

  const effectiveSet = new Set<string>([...role, ...department, ...grants]);
  denies.forEach((k) => effectiveSet.delete(k));

  return {
    effective: [...effectiveSet].sort(),
    sources: {
      role: role.sort(),
      department: department.sort(),
      grants: grants.sort(),
      denies: denies.sort(),
    },
  };
};
