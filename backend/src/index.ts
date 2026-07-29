import { env } from './config/env';
import { buildApp } from './app';
import { prisma } from './lib/prisma';
import { ensureRbacCatalog } from './lib/rbac-sync';
import { ensureDefaultSiteAndBackfill } from './lib/site-defaults';
import { ensureNavGroups } from './lib/nav-group-defaults';
import { sealPendingEntries } from './lib/audit-seal';

const app = buildApp();

const server = app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  // Keep the DB permission catalog in lockstep with the code (grants SUPER_ADMIN
  // any newly added keys). Non-fatal: a sync error must not take the API down.
  ensureRbacCatalog()
    .then(() => console.log('RBAC catalog synced'))
    .catch((err) => console.error('RBAC catalog sync failed:', err));
  // Guarantee a default Site exists and no user/ticket is left site-less before
  // Site scoping is enforced. Non-fatal: never take the API down over it.
  ensureDefaultSiteAndBackfill()
    .then(() => console.log('Default site ensured + backfilled'))
    .catch((err) => console.error('Default-site backfill failed:', err));
  // Sidebar navigation groups: write the default layout on a fresh deploy and
  // repair a missing fallback group. Non-fatal — a bootstrap failure degrades
  // the sidebar to its compiled-in defaults, it must not take the API down.
  ensureNavGroups()
    .then(() => console.log('Navigation groups ensured'))
    .catch((err) => console.error('Navigation-group bootstrap failed:', err));
});

/**
 * Seals the audit hash chain over entries written since the last pass.
 *
 * Runs in the API process rather than the BullMQ worker because the worker
 * requires Redis and is optional, while the size of the unsealed window is a
 * compliance property — it should not depend on whether an optional service is
 * deployed. The pass is idempotent and guarded by its own advisory lock, so
 * multiple API instances are safe.
 */
const sealTimer = setInterval(() => {
  void sealPendingEntries()
    .then((r) => {
      if (r.sealed > 0) console.log(`Audit chain: sealed ${r.sealed} entr${r.sealed === 1 ? 'y' : 'ies'}`);
    })
    .catch((err) => console.error('Audit chain sealing failed:', err));
}, env.AUDIT_SEAL_INTERVAL_MS);
sealTimer.unref(); // never hold the process open on this alone

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
