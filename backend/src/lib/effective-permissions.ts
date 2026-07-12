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
 *   SUPER_ADMIN role → every permission its DB role.permissions relation holds,
 *   deny ignored (bypass preserved). rbac-sync.ts guarantees that relation
 *   includes EVERY permission row — static catalog AND dynamically-generated
 *   (e.g. `wf_type.*`) — as an invariant enforced on every boot. Reading it here
 *   (rather than the static code catalog) is what makes the bypass correct for
 *   dynamic keys; using the static list alone under-counts them.
 *
 * Department inheritance is intentionally direct-only (user.departmentId, not
 * ancestors) — see §3.3. Adding ancestor inheritance is a localized change here.
 */
import { prisma } from './prisma';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

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
  // §3.1 bypass — see the model note above for why this reads the DB relation.
  if (user.role?.name === SUPER_ADMIN_ROLE) {
    return new Set(user.role.permissions.map((p) => p.key));
  }

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
    const keys = user.role.permissions.map((p) => p.key).sort();
    return {
      effective: keys,
      sources: { role: keys, department: [], grants: [], denies: [] },
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
