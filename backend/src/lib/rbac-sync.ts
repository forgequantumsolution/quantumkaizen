/**
 * Idempotent RBAC catalog sync, run once at API startup.
 *
 * Why: route guards use fine-grained keys (e.g. `audit_register.read`). When new
 * module permissions are added in code, the live DB doesn't get them until a
 * re-seed — so the SUPER_ADMIN ends up missing brand-new keys and hits 403s
 * ("Missing required permission: …"). This keeps the deployed DB in lockstep
 * with the code catalog on every deploy (container restart) without a manual seed.
 *
 * Scope is deliberately narrow and safe:
 *   - upsert every permission in the catalog (create missing, refresh metadata);
 *   - guarantee the SUPER_ADMIN role holds ALL permissions (an invariant).
 * Other roles are left untouched so admin customizations made via the UI survive.
 */
import { prisma } from './prisma';
import { PERMISSIONS } from './rbac-catalog';
import { syncWorkflowTypePermissions } from './rbac-workflow-types';
import { backfillPerTypeTicketGrants } from './rbac-ticket-migration';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export async function ensureRbacCatalog(): Promise<void> {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }

  // Backfill/prune the dynamic per-workflow-type keys BEFORE the SUPER_ADMIN
  // "hold everything" step below, so the invariant covers them too.
  await syncWorkflowTypePermissions();

  const all = await prisma.permission.findMany({ select: { id: true } });
  const superAdmin = await prisma.role.findFirst({
    where: { name: SUPER_ADMIN_ROLE },
    select: { id: true },
  });
  if (superAdmin) {
    await prisma.role.update({
      where: { id: superAdmin.id },
      data: { permissions: { set: all.map((p) => ({ id: p.id })) } },
    });
  }

  // Phase 2 (per-module ticket master): mirror global `ticket.*` grants onto the
  // per-type keys so effective access survives the later retirement of the
  // master. Additive + idempotent + self-terminating (no-op once `ticket.*` is
  // removed in Phase 4). See lib/rbac-ticket-migration.ts.
  await backfillPerTypeTicketGrants();
}
