/**
 * Per-form access control for stage form bindings.
 *
 * Each StageFormBinding carries two audiences and a fill mode:
 *   - Fill group  = allowedFillRoles ∪ allowedFillUsers — may enter & submit.
 *   - View group  = allowedViewRoles ∪ allowedViewUsers — may see, never fill.
 *   - fillMode    = ANYONE (one shared copy) | EACH (one copy per person).
 *
 * Semantics (see docs/WORKFLOW_FORM_ACCESS_CONTROL_PLAN.md §2):
 *   canFill = u ∈ fill group                       (view-only never fills)
 *   canRead = u ∈ fill group OR u ∈ view group     (fillers can always read)
 *   SUPER_ADMIN bypasses both (matches approval.layer.ts).
 *   An EMPTY fill group means "legacy open" — everyone may read & fill — so
 *   bindings created before this feature keep working.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { Forbidden } from '../../lib/httpError';

type Db = PrismaClient | Prisma.TransactionClient;

/** Select fragment to load a binding's access lists + mode. */
export const bindingAccessSelect = {
  fillMode: true,
  allowedFillRoles: { select: { id: true } },
  allowedFillUsers: { select: { id: true } },
  allowedViewRoles: { select: { id: true } },
  allowedViewUsers: { select: { id: true } },
} satisfies Prisma.StageFormBindingSelect;

export interface BindingAccess {
  fillMode: 'ANYONE' | 'EACH';
  allowedFillRoles: { id: string }[];
  allowedFillUsers: { id: string }[];
  allowedViewRoles: { id: string }[];
  allowedViewUsers: { id: string }[];
}

export interface Actor {
  userId: string;
  roleId: string | null;
  isSuperAdmin: boolean;
}

/** Resolve the caller's role + super-admin status once. */
export const loadActor = async (db: Db, userId: string): Promise<Actor> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { roleId: true, role: { select: { name: true } } },
  });
  return {
    userId,
    roleId: user?.roleId ?? null,
    isSuperAdmin: user?.role?.name === 'SUPER_ADMIN',
  };
};

/** A binding with no fill roles AND no fill users is treated as open to all. */
export const isLegacyOpen = (b: BindingAccess): boolean =>
  b.allowedFillRoles.length === 0 && b.allowedFillUsers.length === 0;

const inGroup = (
  roles: { id: string }[],
  users: { id: string }[],
  actor: Actor,
): boolean =>
  users.some((u) => u.id === actor.userId) ||
  (actor.roleId != null && roles.some((r) => r.id === actor.roleId));

/** Pure check — may this actor FILL the form? (Fill wins over view-only.) */
export const canFillForm = (b: BindingAccess, actor: Actor): boolean => {
  if (actor.isSuperAdmin) return true;
  if (isLegacyOpen(b)) return true;
  return inGroup(b.allowedFillRoles, b.allowedFillUsers, actor);
};

/** Pure check — may this actor READ the form? (Fillers always can.) */
export const canReadForm = (b: BindingAccess, actor: Actor): boolean => {
  if (actor.isSuperAdmin) return true;
  if (isLegacyOpen(b)) return true;
  if (inGroup(b.allowedFillRoles, b.allowedFillUsers, actor)) return true;
  return inGroup(b.allowedViewRoles, b.allowedViewUsers, actor);
};

export const assertCanFillForm = async (
  db: Db,
  b: BindingAccess,
  userId: string,
): Promise<void> => {
  const actor = await loadActor(db, userId);
  if (!canFillForm(b, actor)) {
    throw Forbidden('You do not have permission to fill this form');
  }
};

export const assertCanReadForm = async (
  db: Db,
  b: BindingAccess,
  userId: string,
): Promise<void> => {
  const actor = await loadActor(db, userId);
  if (!canReadForm(b, actor)) {
    throw Forbidden('You do not have permission to view this form');
  }
};

/**
 * The set of users each owing their own copy in EACH mode: every active member
 * of the fill roles, union the named fill users. Computed from CURRENT role
 * membership, so people who join/leave a role are added/removed naturally and a
 * deactivated user can never deadlock the stage. Returns [] for legacy-open
 * bindings (no defined fill group).
 */
export const expectedSubmitterIds = async (
  db: Db,
  b: BindingAccess,
): Promise<string[]> => {
  if (isLegacyOpen(b)) return [];
  const ids = new Set<string>(b.allowedFillUsers.map((u) => u.id));
  const roleIds = b.allowedFillRoles.map((r) => r.id);
  if (roleIds.length > 0) {
    const members = await db.user.findMany({
      where: { roleId: { in: roleIds }, isActive: true },
      select: { id: true },
    });
    for (const m of members) ids.add(m.id);
  }
  return [...ids];
};
