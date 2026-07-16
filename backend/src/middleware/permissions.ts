import type { Request, Response, NextFunction } from 'express';
import { Forbidden, Unauthorized } from '../lib/httpError';
import { computeEffectivePermissions } from '../lib/effective-permissions';
import { prisma } from '../lib/prisma';
import { wfTypeKey, typeIdFromKey } from '../lib/rbac-workflow-types';
import { findingTypeKey } from '../lib/rbac-findings';

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
 * A ticket action is allowed only when the user holds the per-type key
 * (`wf_type.<typeId>.<action>`) — the global `ticket.<action>` master was
 * retired (docs/per-module-ticket-master-plan.md, Phase 3). `typeId` is null
 * for a workflow with no assigned type — such a ticket has no per-type key
 * that can ever grant it, so only SUPER_ADMIN (which bypasses this check
 * entirely via the effective-permission resolver) can reach it.
 */
export const hasTicketAction = (
  keys: Set<string>,
  typeId: string | null,
  action: TicketAction,
): boolean => {
  if (!typeId) return false;
  return keys.has(wfTypeKey(typeId, action));
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
      const typeId =
        from === 'workflow'
          ? await typeIdForWorkflow((req.body as { workflowId?: string })?.workflowId)
          : await typeIdForTicket(req.params.id as string);

      if (hasTicketAction(keys, typeId, action)) return next();
      return next(
        Forbidden(
          typeId
            ? `Missing required permission: ${wfTypeKey(typeId, action)}`
            : `Ticket has no workflow type — no per-module key can grant ${action}`,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

export interface TicketTypeScope {
  /**
   * Always `false` since the per-module ticket master retirement (Phase 3) —
   * there is no key that grants every type at once anymore. Kept in the type
   * (rather than removed) so `ticket.service.ts` and its caller don't need a
   * shape change; SUPER_ADMIN still reads everything because it holds every
   * `wf_type.*.read` key via the effective-permission bypass, not via `all`.
   */
  all: boolean;
  /** The workflow-type ids the user may read. */
  typeIds: string[];
}

/** Which workflow types a permission set may READ (for scoping ticket lists). */
export const ticketReadScope = (keys: Set<string>): TicketTypeScope => {
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
 * Which workflow types a caller may SEE in workflow lists / pickers — the same
 * set as the ticket read scope (holding `wf_type.<id>.read` = "can access this
 * type"). Aliased rather than duplicated so workflow list/directory scoping
 * (docs/access-control-data-scoping-plan.md, Phase 1) and ticket list scoping
 * share one source of truth and can never drift.
 */
export const workflowTypeReadScope = ticketReadScope;

/**
 * Guard for the ticket LIST route. Passes when the user can read at least one
 * workflow type; the service then scopes the results to that set (see
 * ticket.service.list).
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
    if (scope.typeIds.length > 0) return next();
    return next(Forbidden('No ticket read access — grant at least one workflow-type module'));
  } catch (err) {
    next(err);
  }
};

// ─── Per-workflow-type FINDINGS enforcement ──────────────────────────────────

type FindingAction = 'read' | 'create' | 'update' | 'delete';

/**
 * Where to resolve the workflow-type id a finding request belongs to:
 *  - 'ticketParam' → `req.params.ticketId` (per-ticket findings list)
 *  - 'body'        → `req.body.source_ticket_id` (manual create)
 *  - 'finding'     → `req.params.id` (existing finding → its source ticket)
 *  - 'query'       → `req.query.workflow_type_id` (module register; the id itself)
 */
type FindingFrom = 'ticketParam' | 'body' | 'finding' | 'query';

const typeIdForFinding = async (findingId: string | undefined): Promise<string | null> => {
  if (!findingId) return null;
  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    select: { sourceTicketId: true },
  });
  return finding ? typeIdForTicket(finding.sourceTicketId) : null;
};

const resolveFindingTypeId = async (req: Request, from: FindingFrom): Promise<string | null> => {
  switch (from) {
    case 'ticketParam':
      return typeIdForTicket(req.params.ticketId as string);
    case 'body':
      return typeIdForTicket((req.body as { source_ticket_id?: string })?.source_ticket_id ?? '');
    case 'finding':
      return typeIdForFinding(req.params.id as string);
    case 'query': {
      const q = (req.query as { workflow_type_id?: string })?.workflow_type_id;
      return q && q.length > 0 ? q : null;
    }
  }
};

/**
 * Guard for a findings route. Passes only when the caller holds the per-type key
 * `finding.<typeId>.<action>` for the workflow type the request resolves to.
 * A ticket/type that doesn't support findings (or has no type) yields no key,
 * so only SUPER_ADMIN (effective-permission bypass) can reach it.
 */
export const requireFindingAction = (action: FindingAction, from: FindingFrom) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    try {
      const keys = await loadPermissions(req.user.userId);
      const typeId = await resolveFindingTypeId(req, from);
      if (typeId && keys.has(findingTypeKey(typeId, action))) return next();
      return next(
        Forbidden(
          typeId
            ? `Missing required permission: ${findingTypeKey(typeId, action)}`
            : `Findings not available for this record — no per-module key can grant ${action}`,
        ),
      );
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
