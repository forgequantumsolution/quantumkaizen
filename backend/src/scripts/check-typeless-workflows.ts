/**
 * Pre-Phase-3 risk check for the per-module ticket master
 * (docs/per-module-ticket-master-plan.md).
 *
 * A ticket's access is derived entirely from its workflow's `typeId` (via
 * `wf_type.<typeId>.<verb>` keys). A workflow with typeId = null (a legitimate,
 * schema-supported state — see `workflow.schema.ts`) has NO per-type key that
 * can ever grant access to it. Once Phase 3 removes the global `ticket.*`
 * fallback, tickets on typeless workflows become reachable by SUPER_ADMIN only.
 *
 * This is read-only. Run on every environment BEFORE deciding how Phase 3
 * should handle typeless workflows:
 *
 *   npm run check:typeless-workflows        (dev, via tsx)
 *   node dist/scripts/check-typeless-workflows.js   (prod, compiled)
 */
import { prisma } from '../lib/prisma';

const LOOKS_LIKE_TEST = /\b(e2e|test|probe|temp|tmp|scratch|debug)\b/i;

async function main() {
  const db = (await prisma.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() as db'))[0]!.db;
  const workflows = await prisma.workflow.findMany({
    where: { typeId: null },
    select: { id: true, name: true, createdAt: true, isDeleted: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Typeless-workflow check — DB: ${db}`);
  console.log(`Workflows with typeId = null: ${workflows.length}\n`);

  if (workflows.length === 0) {
    console.log('✅ None. Phase 3 needs no special handling for typeless workflows here.');
    return;
  }

  let ticketTotal = 0;
  let likelyTestCount = 0;
  for (const w of workflows) {
    const tickets = await prisma.ticketFlow.findMany({
      where: { workflowId: w.id },
      select: { ticket: { select: { id: true, uniqueId: true, title: true, isDeleted: true } } },
    });
    const liveTickets = tickets.filter((t) => !t.ticket.isDeleted);
    ticketTotal += liveTickets.length;
    const looksTest = LOOKS_LIKE_TEST.test(w.name);
    if (looksTest) likelyTestCount++;
    const flag = looksTest ? '(looks like a test artifact by name)' : '⚠️  NAME DOES NOT LOOK LIKE A TEST ARTIFACT';
    console.log(
      `- "${w.name}" [${w.id}] created ${w.createdAt.toISOString().slice(0, 10)}${w.isDeleted ? ' (workflow soft-deleted)' : ''} ${flag}`,
    );
    for (const t of liveTickets) {
      console.log(`    ticket ${t.ticket.uniqueId} — "${t.ticket.title}"`);
    }
  }

  console.log(`\nTotal live tickets on typeless workflows: ${ticketTotal}`);
  console.log(`Workflows that look like test artifacts by name: ${likelyTestCount}/${workflows.length}`);
  if (likelyTestCount < workflows.length) {
    console.log(
      '\n⚠️  At least one typeless workflow does NOT look like a test artifact — review by hand before Phase 3.',
    );
  } else {
    console.log('\nAll typeless workflows look like test artifacts by name — still review before Phase 3, this is a heuristic only.');
  }
}

main()
  .catch((e) => {
    console.error('Check failed to run:', e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
