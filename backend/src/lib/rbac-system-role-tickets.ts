/**
 * Fresh-install safety net for the per-module ticket master
 * (docs/per-module-ticket-master-plan.md, Phase 4).
 *
 * Existing environments got their per-type ticket grants via the Phase 2
 * backfill (mirrored from `ticket.*`, confirmed GREEN via `gate:ticket-grants`
 * before Phase 3/4 shipped there). But a BRAND NEW environment seeded after
 * Phase 4 never held `ticket.*` at all, so there is nothing for that backfill
 * to mirror — without this, a fresh install's system roles would end up with
 * zero ticket access.
 *
 * This grants the documented default ticket verbs (matching what `ticket.*`
 * used to give these system roles — see prisma/seed.ts git history) to each
 * named system role, for every current workflow type — but ONLY when that role
 * currently holds NO `wf_type.*` permission at all.
 *
 * That scoping is what makes this safe to run on every boot: an admin who has
 * already customized (or deliberately reduced) a role's per-type ticket access
 * always leaves at least one `wf_type.*` grant in place, so this never touches
 * it — consistent with rbac-sync.ts's design principle that admin
 * customizations made via the UI survive. Idempotent; no-op for roles that
 * don't exist, already have any per-type grant, or when there are no workflow
 * types yet.
 */
import { prisma } from './prisma';
import { wfTypeKey } from './rbac-workflow-types';

/** Mirrors the historical `ticket.*` grants these system roles held (prisma/seed.ts). */
const SYSTEM_ROLE_TICKET_VERBS: Record<string, readonly string[]> = {
  QMS_ADMIN: ['read', 'create', 'update', 'delete', 'transition'],
  QUALITY_ENGINEER: ['read', 'create', 'update', 'transition'],
  AUDITOR: ['read', 'transition'],
  DOCUMENT_CONTROLLER: ['read', 'transition'],
  READ_ONLY: ['read'],
};

export const ensureSystemRoleTicketGrants = async (): Promise<void> => {
  const types = await prisma.workflowType.findMany({ select: { id: true } });
  if (types.length === 0) return;

  for (const [roleName, verbs] of Object.entries(SYSTEM_ROLE_TICKET_VERBS)) {
    const role = await prisma.role.findFirst({
      where: { name: roleName },
      select: {
        id: true,
        permissions: { where: { key: { startsWith: 'wf_type.' } }, select: { id: true } },
      },
    });
    if (!role) continue;
    // Never touch a role that already has ANY per-type grant — it has either
    // already been migrated (Phase 2) or deliberately customized by an admin.
    if (role.permissions.length > 0) continue;

    const wantedKeys = types.flatMap((t) => verbs.map((v) => wfTypeKey(t.id, v)));
    const perms = await prisma.permission.findMany({
      where: { key: { in: wantedKeys } },
      select: { id: true },
    });
    if (perms.length === 0) continue;
    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: { connect: perms.map((p) => ({ id: p.id })) } },
    });
  }
};
