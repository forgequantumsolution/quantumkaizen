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
 *
 * Openness is EXPLICIT via `isRestricted` (schema column, default true for new
 * bindings). `isRestricted = false` means "open to all" — everyone may read &
 * fill (ANYONE semantics). Existing bindings were backfilled at migration time:
 * any binding that already had a fill/view group stayed restricted; groupless
 * ("legacy open") bindings were set open, so behaviour was preserved exactly.
 * A brand-new binding with no group is therefore closed, not silently open.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { Forbidden } from '../../lib/httpError';

type Db = PrismaClient | Prisma.TransactionClient;

/** Select fragment to load a binding's access lists + mode. */
export const bindingAccessSelect = {
  isRestricted: true,
  fillMode: true,
  allowedFillRoles: { select: { id: true } },
  allowedFillUsers: { select: { id: true } },
  allowedViewRoles: { select: { id: true } },
  allowedViewUsers: { select: { id: true } },
} satisfies Prisma.StageFormBindingSelect;

export interface BindingAccess {
  isRestricted: boolean;
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

/** A non-restricted binding is open to everyone (read & fill). */
export const isOpenToAll = (b: BindingAccess): boolean => !b.isRestricted;

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
  if (isOpenToAll(b)) return true;
  return inGroup(b.allowedFillRoles, b.allowedFillUsers, actor);
};

/** Pure check — may this actor READ the form? (Fillers always can.) */
export const canReadForm = (b: BindingAccess, actor: Actor): boolean => {
  if (actor.isSuperAdmin) return true;
  if (isOpenToAll(b)) return true;
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
 * deactivated user can never deadlock the stage. Returns [] for open-to-all
 * bindings (no defined fill group).
 */
export const expectedSubmitterIds = async (
  db: Db,
  b: BindingAccess,
): Promise<string[]> => {
  if (isOpenToAll(b)) return [];
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
