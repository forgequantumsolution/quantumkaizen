import { env } from './config/env';
import { buildApp } from './app';
import { prisma } from './lib/prisma';
import { ensureRbacCatalog } from './lib/rbac-sync';

const app = buildApp();

const server = app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  // Keep the DB permission catalog in lockstep with the code (grants SUPER_ADMIN
  // any newly added keys). Non-fatal: a sync error must not take the API down.
  ensureRbacCatalog()
    .then(() => console.log('RBAC catalog synced'))
    .catch((err) => console.error('RBAC catalog sync failed:', err));
});

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
