import type { Request, Response, NextFunction } from 'express';
import { Forbidden, Unauthorized } from '../lib/httpError';
import { computeEffectivePermissions } from '../lib/effective-permissions';
import { prisma } from '../lib/prisma';
import { wfTypeKey, typeIdFromKey } from '../lib/rbac-workflow-types';

const cache = new Map<string, { keys: Set<string>; expires: number }>();
const TTL_MS = 30_000;

const loadPermissions = async (userId: string): Promise<Set<string>> => {
  const cached = cache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.keys;

  // Resolve role + department + user-override permissions via the shared resolver
  // so the guard, /login and /me can never drift. Keeps the 30 s cache.
  const keys = await computeEffectivePermissions(userId);
  cache.set(userId, { keys, expires: Date.now() + TTL_MS });
  return keys;
};

/** Cached effective-permission set for a user — reused by guards and services. */
export const getEffectivePermissionKeys = loadPermissions;

export const invalidatePermissionCache = (userId?: string) => {
  if (userId) cache.delete(userId);
  else cache.clear();
};

export const requirePermission = (key: string) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    try {
      const keys = await loadPermissions(req.user.userId);
      if (!keys.has(key)) {
        return next(Forbidden(`Missing required permission: ${key}`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };

/**
 * OR-guard: passes when the user holds ANY of the given keys. Used where one
 * surface is reachable by two audiences with different keys — e.g. the sites
 * list is served both to admins (`site.read`) and to operational pickers that
 * only hold the broader `org.read`.
 */
export const requireAnyPermission = (...anyOf: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    try {
      const keys = await loadPermissions(req.user.userId);
      if (!anyOf.some((k) => keys.has(k))) {
        return next(Forbidden(`Missing required permission: ${anyOf.join(' or ')}`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };

// ─── Per-workflow-type ticket enforcement ────────────────────────────────────

type TicketAction = 'read' | 'create' | 'update' | 'delete' | 'transition';

/**
 * OR-bridge: a ticket action is allowed when the user holds EITHER the
 * per-type key (`wf_type.<typeId>.<action>`) OR the global `ticket.<action>`
 * master key. `typeId` is null for workflows with no type (or Audit, which has
 * no generated per-type key) → only the global key grants.
 */
export const hasTicketAction = (
  keys: Set<string>,
  typeId: string | null,
  action: TicketAction,
): boolean => {
  if (keys.has(`ticket.${action}`)) return true;
  if (typeId && keys.has(wfTypeKey(typeId, action))) return true;
  return false;
};

const typeIdForTicket = async (ticketId: string): Promise<string | null> => {
  const flow = await prisma.ticketFlow.findFirst({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    select: { workflow: { select: { typeId: true } } },
  });
  return flow?.workflow?.typeId ?? null;
};

const typeIdForWorkflow = async (workflowId: string | undefined): Promise<string | null> => {
  if (!workflowId) return null;
  const wf = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { typeId: true },
  });
  return wf?.typeId ?? null;
};

/**
 * Guard for a single-ticket route. `from` says where to resolve the ticket's
 * workflow type: 'ticket' → `req.params.id` (an existing ticket); 'workflow' →
 * `req.body.workflowId` (raising a new ticket).
 */
export const requireTicketAction = (action: TicketAction, from: 'ticket' | 'workflow' = 'ticket') =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    try {
      const keys = await loadPermissions(req.user.userId);
      // Fast path: the global master key grants regardless of type.
      if (keys.has(`ticket.${action}`)) return next();

      const typeId =
        from === 'workflow'
          ? await typeIdForWorkflow((req.body as { workflowId?: string })?.workflowId)
          : await typeIdForTicket(req.params.id as string);

      if (hasTicketAction(keys, typeId, action)) return next();
      return next(Forbidden(`Missing required permission: ticket.${action}`));
    } catch (err) {
      next(err);
    }
  };

export interface TicketTypeScope {
  /** true → user may read every type (holds the global `ticket.read` master). */
  all: boolean;
  /** When !all, the set of workflow-type ids the user may read. */
  typeIds: string[];
}

/** Which workflow types a permission set may READ (for scoping ticket lists). */
export const ticketReadScope = (keys: Set<string>): TicketTypeScope => {
  if (keys.has('ticket.read')) return { all: true, typeIds: [] };
  const typeIds = new Set<string>();
  for (const key of keys) {
    if (key.endsWith('.read')) {
      const id = typeIdFromKey(key);
      if (id) typeIds.add(id);
    }
  }
  return { all: false, typeIds: [...typeIds] };
};

/**
 * Guard for the ticket LIST route. Passes when the user can read either every
 * type (global master) or at least one type; the service then scopes the
 * results to that set (see ticket.service.list).
 */
export const requireTicketListAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.user) return next(Unauthorized());
  try {
    const keys = await loadPermissions(req.user.userId);
    const scope = ticketReadScope(keys);
    if (scope.all || scope.typeIds.length > 0) return next();
    return next(Forbidden('Missing required permission: ticket.read'));
  } catch (err) {
    next(err);
  }
};

// ─── Per-site scoping ─────────────────────────────────────────────────────────

/** Holders bypass per-site scoping and may view/switch across every site. */
export const SITE_VIEW_ALL = 'site.view_all';

export interface SiteScope {
  /** true → user may see every site (holds `site.view_all`). */
  all: boolean;
  /** When !all, the site ids the user is limited to (their own assigned site). */
  siteIds: string[];
}

/**
 * Which sites a user may see. Holders of `site.view_all` (admins) get every
 * site; everyone else is pinned to their single assigned site. A user with no
 * site (shouldn't happen post-backfill) gets an empty scope → sees nothing,
 * the safe closed default.
 */
export const resolveSiteScope = async (userId: string): Promise<SiteScope> => {
  const keys = await loadPermissions(userId);
  if (keys.has(SITE_VIEW_ALL)) return { all: true, siteIds: [] };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { siteId: true },
  });
  return { all: false, siteIds: user?.siteId ? [user.siteId] : [] };
};

/**
 * Build the `where.siteId` clause for a ticket list. Intersects the caller's
 * allowed scope with an optional requested site (the navbar selection). A
 * requested site OUTSIDE the allowed scope is ignored — the selection can never
 * widen access (the hard boundary).
 *   - undefined  → no constraint (viewAll + no specific request)
 *   - { in: [...] } → constrained to the resolved set (may be empty → no rows)
 */
export const siteFilterFor = (
  scope: SiteScope,
  requestedSiteId?: string | null,
): { in: string[] } | undefined => {
  if (scope.all) return requestedSiteId ? { in: [requestedSiteId] } : undefined;
  if (requestedSiteId && scope.siteIds.includes(requestedSiteId)) {
    return { in: [requestedSiteId] };
  }
  return { in: scope.siteIds };
};

/** Whether the caller may assign a ticket to `siteId` (create / update). */
export const canUseSite = (scope: SiteScope, siteId: string): boolean =>
  scope.all || scope.siteIds.includes(siteId);
