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
