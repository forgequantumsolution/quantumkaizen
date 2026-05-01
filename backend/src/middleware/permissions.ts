import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Forbidden, Unauthorized } from '../lib/httpError';

const cache = new Map<string, { keys: Set<string>; expires: number }>();
const TTL_MS = 30_000;

const loadPermissions = async (userId: string): Promise<Set<string>> => {
  const cached = cache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.keys;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: { select: { permissions: { select: { key: true } } } },
    },
  });
  const keys = new Set((user?.role?.permissions ?? []).map((p) => p.key));
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
