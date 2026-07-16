/**
 * One-time cleanup for DUPLICATED audit findings / NCs.
 *
 * Background: the compliance-sync used to build its idempotency `dedupeKey` with
 * a different prefix on the ticket-close path (`ticketId:submissionId:…`) than on
 * the checklist-submission / program paths (`submissionId:…`). The same checklist
 * disposition therefore produced two Findings (+ two NCs) with identical data.
 * The code is now fixed (key is submission-scoped everywhere), but rows created
 * before the fix remain. This script removes the extras.
 *
 * Logical identity of a disposition = programId + evidence.submissionId +
 * evidence.section + evidence.field + evidence.result. Within each duplicate
 * group we KEEP the most-progressed record (one whose NC is linked to a CAPA, or
 * whose NC status has moved past OPEN, else the earliest by createdAt) and delete
 * the rest. Deleting a Finding cascades to its NonConformance.
 *
 * Usage:
 *   npx tsx prisma/dedupe-audit-findings.ts          # dry-run (report only)
 *   npx tsx prisma/dedupe-audit-findings.ts --apply  # actually delete
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

interface Evidence {
  submissionId?: string;
  section?: string;
  field?: string;
  result?: string;
  dedupeKey?: string;
}

async function main() {
  const findings = await prisma.auditFinding.findMany({
    select: {
      id: true,
      findingNumber: true,
      programId: true,
      evidence: true,
      createdAt: true,
      nonConformance: {
        select: { id: true, ncNumber: true, status: true, capaTicketId: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by logical disposition identity.
  const groups = new Map<string, typeof findings>();
  for (const f of findings) {
    const e = (f.evidence ?? {}) as Evidence;
    // Only findings that came from the compliance sync carry submissionId.
    if (!e.submissionId || !e.field) continue;
    const key = [f.programId, e.submissionId, e.section ?? '', e.field, e.result ?? ''].join('|');
    const arr = groups.get(key) ?? [];
    arr.push(f);
    groups.set(key, arr);
  }

  // "Most progressed" wins so we never drop a CAPA-linked / actioned NC.
  const progressScore = (f: (typeof findings)[number]) => {
    const nc = f.nonConformance;
    if (!nc) return 0;
    let s = 1;
    if (nc.capaTicketId) s += 2;
    if (nc.status && nc.status !== 'OPEN') s += 1;
    return s;
  };

  const toDelete: Array<{ id: string; findingNumber: string; ncNumber?: string }> = [];
  let dupGroups = 0;

  for (const [, arr] of groups) {
    if (arr.length < 2) continue;
    dupGroups += 1;
    // Sort: highest progress first, then earliest createdAt — that one is kept.
    const sorted = [...arr].sort(
      (a, b) =>
        progressScore(b) - progressScore(a) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const [keep, ...extras] = sorted;
    console.log(
      `\nDuplicate group (${arr.length}) — keeping ${keep.findingNumber}` +
        `${keep.nonConformance ? ` / ${keep.nonConformance.ncNumber}` : ''}`,
    );
    for (const ex of extras) {
      console.log(
        `  delete ${ex.findingNumber}${ex.nonConformance ? ` / ${ex.nonConformance.ncNumber}` : ''}`,
      );
      toDelete.push({
        id: ex.id,
        findingNumber: ex.findingNumber,
        ncNumber: ex.nonConformance?.ncNumber,
      });
    }
  }

  console.log(
    `\n${dupGroups} duplicated disposition group(s); ${toDelete.length} extra finding(s) to remove.`,
  );

  if (toDelete.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to delete the extras.');
    return;
  }

  // Delete extras (NC cascades via onDelete: Cascade on NonConformance.finding).
  const ids = toDelete.map((d) => d.id);
  const { count } = await prisma.auditFinding.deleteMany({ where: { id: { in: ids } } });
  console.log(`\nDeleted ${count} duplicate finding(s) (and their NCs).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
