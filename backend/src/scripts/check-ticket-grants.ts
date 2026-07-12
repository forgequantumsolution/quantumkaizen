/**
 * Phase 3 GO/NO-GO gate for the per-module ticket master
 * (docs/per-module-ticket-master-plan.md).
 *
 * Phase 3 removes the global `ticket.*` master's OR-bridge, so a per-type
 * `wf_type.<id>.<verb>` key becomes the ONLY thing granting ticket access. This
 * script asserts the Phase 2 backfill has fully run on THIS database: every
 * subject that relies on `ticket.<verb>` already has per-type coverage for every
 * live workflow type. Run it on each environment before shipping Phase 3.
 *
 *   npm run gate:ticket-grants
 *
 * Exit 0 = GREEN (safe to ship Phase 3). Exit 1 = RED (gaps — do NOT ship).
 *
 * Coverage rule per verb:
 *  - Role / department holding `ticket.<verb>` → must hold `wf_type.<id>.<verb>`
 *    for ALL live types.
 *  - User with ANY override (GRANT or DENY) on `ticket.<verb>` → must have a
 *    `wf_type.<id>.<verb>` override row (any effect) for ALL live types. Effect
 *    correctness is guaranteed by the backfill (mirrors the global effect and
 *    preserves pre-existing per-type overrides), so this only checks presence.
 */
import { prisma } from '../lib/prisma';

const VERBS = ['read', 'create', 'update', 'delete', 'transition'] as const;

interface Gap {
  subjectType: 'role' | 'department' | 'user';
  subject: string;
  verb: string;
  missingTypeIds: string[];
}

async function findGaps(): Promise<{ gaps: Gap[]; typeCount: number }> {
  const types = await prisma.workflowType.findMany({ select: { id: true, name: true } });
  const typeIds = types.map((t) => t.id);
  const gaps: Gap[] = [];
  if (typeIds.length === 0) return { gaps, typeCount: 0 };

  for (const verb of VERBS) {
    const wantKeys = new Set(typeIds.map((id) => `wf_type.${id}.${verb}`));
    const missingFrom = (heldKeys: Set<string>): string[] =>
      typeIds.filter((id) => !heldKeys.has(`wf_type.${id}.${verb}`));

    // ── Roles ──
    const roles = await prisma.role.findMany({
      where: { permissions: { some: { key: `ticket.${verb}` } }, name: { not: 'SUPER_ADMIN' } },
      select: { name: true, permissions: { where: { key: { in: [...wantKeys] } }, select: { key: true } } },
    });
    for (const r of roles) {
      const missing = missingFrom(new Set(r.permissions.map((p) => p.key)));
      if (missing.length) gaps.push({ subjectType: 'role', subject: r.name, verb, missingTypeIds: missing });
    }

    // ── Departments ──
    const depts = await prisma.department.findMany({
      where: { permissions: { some: { key: `ticket.${verb}` } } },
      select: { name: true, permissions: { where: { key: { in: [...wantKeys] } }, select: { key: true } } },
    });
    for (const d of depts) {
      const missing = missingFrom(new Set(d.permissions.map((p) => p.key)));
      if (missing.length) gaps.push({ subjectType: 'department', subject: d.name, verb, missingTypeIds: missing });
    }

    // ── User overrides (presence of a per-type override, any effect) ──
    const overs = await prisma.userPermission.findMany({
      where: { permission: { key: `ticket.${verb}` } },
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

async function main() {
  const db = (await prisma.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() as db'))[0]!.db;
  const { gaps, typeCount } = await findGaps();
  console.log(`Ticket-grant migration gate — DB: ${db}, live workflow types: ${typeCount}`);
  if (typeCount === 0) {
    console.log('No workflow types — nothing to gate. (Trivially green.)');
    return;
  }
  if (gaps.length === 0) {
    console.log('\n✅ GREEN — every ticket.* subject has full per-type coverage. Safe to ship Phase 3.');
    return;
  }
  console.log(`\n❌ RED — ${gaps.length} gap(s). Do NOT ship Phase 3 until the Phase 2 backfill completes here.\n`);
  for (const g of gaps) {
    console.log(`  ${g.subjectType} "${g.subject}" · ticket.${g.verb} → missing ${g.missingTypeIds.length}/${typeCount} per-type keys`);
  }
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('Gate check failed to run:', e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
