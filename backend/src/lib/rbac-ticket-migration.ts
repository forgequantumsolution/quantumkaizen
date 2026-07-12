/**
 * Phase 2 of the per-module ticket master (docs/per-module-ticket-master-plan.md).
 *
 * Mirrors every global `ticket.<verb>` grant onto the equivalent per-type
 * `wf_type.<typeId>.<verb>` grant, for EVERY workflow type, so that a subject's
 * effective ticket access is preserved once the global `ticket.*` master is
 * retired (Phase 3/4). While the master still exists this is purely additive —
 * the OR-bridge keeps behaviour identical — so it is safe to run before the flip.
 *
 * Properties:
 *  - Idempotent: only connects/creates what is missing; safe to run every boot.
 *  - Self-terminating: keyed on the presence of the global `ticket.*` catalog
 *    rows. Once Phase 4 removes them there is nothing to mirror → no-op.
 *  - Non-destructive for user overrides: replicates GRANT and DENY to each
 *    per-type key, but NEVER overwrites an existing explicit per-type override
 *    (an admin's deliberate per-module choice always wins).
 *  - SUPER_ADMIN is skipped — it already holds every key via rbac-sync + the
 *    effective-permission bypass.
 */
import { prisma } from './prisma';

const TICKET_VERBS = ['read', 'create', 'update', 'delete', 'transition'] as const;
const ticketKey = (verb: string): string => `ticket.${verb}`;
const wfKey = (typeId: string, verb: string): string => `wf_type.${typeId}.${verb}`;

export interface TicketGrantGap {
  subjectType: 'role' | 'department' | 'user';
  subject: string;
  verb: string;
  missingTypeIds: string[];
}

/**
 * Find every subject that holds a global `ticket.<verb>` grant but is missing
 * the equivalent `wf_type.<id>.<verb>` for one or more live workflow types —
 * i.e. the Phase 2 backfill hasn't (yet) fully covered them. Shared by the
 * `gate:ticket-grants` CLI (pre-Phase-3 go/no-go) and the boot-time warning in
 * `rbac-sync.ts` (post-Phase-3/4 observability net).
 */
export async function findUnmigratedTicketGrants(): Promise<{ gaps: TicketGrantGap[]; typeCount: number }> {
  const types = await prisma.workflowType.findMany({ select: { id: true } });
  const typeIds = types.map((t) => t.id);
  const gaps: TicketGrantGap[] = [];
  if (typeIds.length === 0) return { gaps, typeCount: 0 };

  for (const verb of TICKET_VERBS) {
    const wantKeys = new Set(typeIds.map((id) => wfKey(id, verb)));
    const missingFrom = (heldKeys: Set<string>): string[] =>
      typeIds.filter((id) => !heldKeys.has(wfKey(id, verb)));

    const roles = await prisma.role.findMany({
      where: { permissions: { some: { key: ticketKey(verb) } }, name: { not: 'SUPER_ADMIN' } },
      select: { name: true, permissions: { where: { key: { in: [...wantKeys] } }, select: { key: true } } },
    });
    for (const r of roles) {
      const missing = missingFrom(new Set(r.permissions.map((p) => p.key)));
      if (missing.length) gaps.push({ subjectType: 'role', subject: r.name, verb, missingTypeIds: missing });
    }

    const depts = await prisma.department.findMany({
      where: { permissions: { some: { key: ticketKey(verb) } } },
      select: { name: true, permissions: { where: { key: { in: [...wantKeys] } }, select: { key: true } } },
    });
    for (const d of depts) {
      const missing = missingFrom(new Set(d.permissions.map((p) => p.key)));
      if (missing.length) gaps.push({ subjectType: 'department', subject: d.name, verb, missingTypeIds: missing });
    }

    const overs = await prisma.userPermission.findMany({
      where: { permission: { key: ticketKey(verb) } },
      select: { userId: true, user: { select: { email: true } } },
    });
    for (const o of overs) {
      const held = await prisma.userPermission.findMany({
        where: { userId: o.userId, permission: { key: { in: [...wantKeys] } } },
        select: { permission: { select: { key: true } } },
      });
      const missing = missingFrom(new Set(held.map((h) => h.permission.key)));
      if (missing.length) gaps.push({ subjectType: 'user', subject: o.user?.email ?? o.userId, verb, missingTypeIds: missing });
    }
  }
  return { gaps, typeCount: typeIds.length };
}

export const backfillPerTypeTicketGrants = async (): Promise<void> => {
  const types = await prisma.workflowType.findMany({ select: { id: true } });
  if (types.length === 0) return;
  const typeIds = types.map((t) => t.id);

  // Resolve permission ids for every key we touch in one query.
  const wantedKeys = [
    ...TICKET_VERBS.map(ticketKey),
    ...typeIds.flatMap((id) => TICKET_VERBS.map((v) => wfKey(id, v))),
  ];
  const perms = await prisma.permission.findMany({
    where: { key: { in: wantedKeys } },
    select: { id: true, key: true },
  });
  const idByKey = new Map(perms.map((p) => [p.key, p.id]));

  // Self-terminate: if the global master keys are gone (post Phase 4) there is
  // nothing to mirror.
  const masterPresent = TICKET_VERBS.some((v) => idByKey.has(ticketKey(v)));
  if (!masterPresent) return;

  for (const verb of TICKET_VERBS) {
    const globalKey = ticketKey(verb);
    const globalId = idByKey.get(globalKey);
    if (!globalId) continue;

    const perTypeIds = typeIds
      .map((id) => idByKey.get(wfKey(id, verb)))
      .filter((x): x is string => !!x);
    if (perTypeIds.length === 0) continue;
    const perTypeSet = new Set(perTypeIds);

    // ── Roles (additive M2M grant) ──
    const roles = await prisma.role.findMany({
      where: { permissions: { some: { key: globalKey } }, name: { not: 'SUPER_ADMIN' } },
      select: {
        id: true,
        permissions: { where: { key: { startsWith: 'wf_type.' } }, select: { id: true } },
      },
    });
    for (const role of roles) {
      const have = new Set(role.permissions.map((p) => p.id));
      const toConnect = perTypeIds.filter((pid) => !have.has(pid));
      if (toConnect.length) {
        await prisma.role.update({
          where: { id: role.id },
          data: { permissions: { connect: toConnect.map((id) => ({ id })) } },
        });
      }
    }

    // ── Departments (additive M2M grant) ──
    const depts = await prisma.department.findMany({
      where: { permissions: { some: { key: globalKey } } },
      select: {
        id: true,
        permissions: { where: { key: { startsWith: 'wf_type.' } }, select: { id: true } },
      },
    });
    for (const dept of depts) {
      const have = new Set(dept.permissions.map((p) => p.id));
      const toConnect = perTypeIds.filter((pid) => !have.has(pid));
      if (toConnect.length) {
        await prisma.department.update({
          where: { id: dept.id },
          data: { permissions: { connect: toConnect.map((id) => ({ id })) } },
        });
      }
    }

    // ── User overrides (replicate GRANT/DENY, never clobber an existing one) ──
    const overrides = await prisma.userPermission.findMany({
      where: { permissionId: globalId },
      select: { userId: true, effect: true },
    });
    for (const ov of overrides) {
      const existing = await prisma.userPermission.findMany({
        where: { userId: ov.userId, permissionId: { in: perTypeIds } },
        select: { permissionId: true },
      });
      const existingSet = new Set(existing.map((e) => e.permissionId));
      const toCreate = [...perTypeSet].filter((pid) => !existingSet.has(pid));
      if (toCreate.length) {
        await prisma.userPermission.createMany({
          data: toCreate.map((permissionId) => ({
            userId: ov.userId,
            permissionId,
            effect: ov.effect,
            reason: 'Auto: per-module ticket master migration (Phase 2)',
          })),
          skipDuplicates: true,
        });
      }
    }
  }
};
