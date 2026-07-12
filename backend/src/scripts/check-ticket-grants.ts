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
 *
 * Once Phase 4 removes the `ticket.*` catalog rows entirely, this trivially
 * finds zero subjects to check and always reports GREEN — safe to keep running.
 */
import { prisma } from '../lib/prisma';
import { findUnmigratedTicketGrants } from '../lib/rbac-ticket-migration';

async function main() {
  const db = (await prisma.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() as db'))[0]!.db;
  const { gaps, typeCount } = await findUnmigratedTicketGrants();
  console.log(`Ticket-grant migration gate — DB: ${db}, live workflow types: ${typeCount}`);
  if (typeCount === 0) {
    console.log('No workflow types — nothing to gate. (Trivially green.)');
    return;
  }
  if (gaps.length === 0) {
    const ticketRows = await prisma.permission.count({ where: { module: 'TICKET' } });
    console.log(
      ticketRows === 0
        ? '\n✅ GREEN — no `ticket.*` master keys remain here (Phase 4 already applied). Nothing to gate.'
        : '\n✅ GREEN — every ticket.* subject has full per-type coverage. Safe to ship Phase 3.',
    );
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
