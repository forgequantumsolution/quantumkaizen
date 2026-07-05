import type { Request, Response, NextFunction } from 'express';
import { Forbidden, Unauthorized } from '../lib/httpError';
import { computeEffectivePermissions } from '../lib/effective-permissions';

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
