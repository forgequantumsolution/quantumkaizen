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
import { syncFindingTypePermissions } from './rbac-findings';
import { backfillPerTypeTicketGrants, findUnmigratedTicketGrants } from './rbac-ticket-migration';
import { ensureSystemRoleTicketGrants } from './rbac-system-role-tickets';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

/**
 * Delete any `TICKET`-module permission row no longer in the code catalog —
 * i.e. the retired global `ticket.*` master keys (Phase 4 of
 * docs/per-module-ticket-master-plan.md). Cascades to remove role/department/
 * user-override grants referencing them; harmless, since enforcement stopped
 * reading these keys in Phase 3 and every effective grant was already mirrored
 * onto `wf_type.*` keys during the Phase 2 rollout (verified via the gate).
 * A no-op once nothing with module `TICKET` remains.
 */
const pruneRetiredTicketMasterKeys = async (): Promise<void> => {
  const currentTicketKeys = PERMISSIONS.filter((p) => p.module === 'TICKET').map((p) => p.key);
  const orphaned = await prisma.permission.findMany({
    where: { module: 'TICKET', key: { notIn: currentTicketKeys.length ? currentTicketKeys : ['__none__'] } },
    select: { id: true },
  });
  if (orphaned.length > 0) {
    await prisma.permission.deleteMany({ where: { id: { in: orphaned.map((p) => p.id) } } });
  }
};

/**
 * Delete the retired global `FINDING`-module keys (`finding.read/create/update/
 * delete`). Findings access is now per-workflow-type (`finding.<typeId>.*`,
 * module `FINDING_TYPE`), so the single shared master was dropped. Cascades to
 * remove any lingering grants; a no-op once nothing with module `FINDING`
 * remains. Note module `FINDING_TYPE` is a different module, so the per-type
 * keys are never touched here.
 */
const pruneRetiredGlobalFindingKeys = async (): Promise<void> => {
  const orphaned = await prisma.permission.findMany({
    where: { module: 'FINDING' },
    select: { id: true },
  });
  if (orphaned.length > 0) {
    await prisma.permission.deleteMany({ where: { id: { in: orphaned.map((p) => p.id) } } });
  }
};

export async function ensureRbacCatalog(): Promise<void> {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }

  await pruneRetiredTicketMasterKeys();
  await pruneRetiredGlobalFindingKeys();

  // Backfill/prune the dynamic per-workflow-type keys BEFORE the SUPER_ADMIN
  // "hold everything" step below, so the invariant covers them too.
  await syncWorkflowTypePermissions();
  // Same for the per-type FINDINGS keys (findings.<typeId>.*).
  await syncFindingTypePermissions();

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

  // Phase 2 (per-module ticket master): mirror any remaining global `ticket.*`
  // grants onto the per-type keys. Additive + idempotent + self-terminating —
  // a no-op now that `ticket.*` is pruned above on every environment that has
  // rolled forward past Phase 4. See lib/rbac-ticket-migration.ts.
  await backfillPerTypeTicketGrants();

  // Phase 4 fresh-install safety net: grant the documented default ticket
  // verbs to system roles that have never held any per-type key at all (i.e.
  // never migrated because `ticket.*` never existed here). See
  // lib/rbac-system-role-tickets.ts.
  await ensureSystemRoleTicketGrants();

  // Observability net: warn (non-fatal) if any subject still relies on
  // `ticket.*` without full per-type coverage. Should be empty on every boot
  // once the environment has rolled past Phase 4 (see pruneRetiredTicketMasterKeys
  // above) — kept as cheap insurance against a partial/mixed rollout.
  const { gaps } = await findUnmigratedTicketGrants();
  if (gaps.length > 0) {
    console.warn(
      `⚠️  RBAC: ${gaps.length} subject(s) still have incomplete per-type ticket coverage:`,
      gaps.map((g) => `${g.subjectType} "${g.subject}" · ticket.${g.verb} (missing ${g.missingTypeIds.length} type(s))`),
    );
  }
}
