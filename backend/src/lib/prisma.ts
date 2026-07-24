import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { createAuditExtension } from './audit-prisma-extension';

/**
 * Unextended client. Used only by the audit writer, so that its own inserts do
 * not re-enter the interceptor pipeline.
 */
const base = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * The client every service uses. Writes to in-scope models are audited
 * automatically — see lib/audit-scope.ts for what is covered, what is left to
 * hand-written entries, and what is deliberately not audited.
 *
 * The cast keeps the existing `PrismaClient` type surface: extended clients
 * expose the same model delegates, and services should not have to know the
 * interceptor exists.
 */
export const prisma = base.$extends(createAuditExtension(base)) as unknown as PrismaClient;

/** Escape hatch for work that must not be intercepted (audit writes, migrations). */
export const prismaBase = base;
