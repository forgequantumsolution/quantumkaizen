/**
 * CLI runner: executes the SLA + approval-deadline sweeps **once** and exits.
 * Useful for ops dry-runs and for the smoke harness (no Redis dep — just hits
 * Prisma directly).
 *
 *   npm run sla:sweep           # runs both sweeps
 *   npm run sla:sweep -- --sla  # only the combined SLA sweep
 *   npm run sla:sweep -- --approval  # only the approval-deadline sweep
 *
 * In production these are kicked by BullMQ on a 15-min / 30-min cron schedule
 * (see backend/src/jobs/worker.ts — P3.6.b follow-up).
 */
import { prisma } from '../lib/prisma';
import { checkSlaTimers } from './sweeps/checkSlaTimers';
import { checkApprovalDeadlines } from './sweeps/checkApprovalDeadlines';

const args = process.argv.slice(2);
const runSla = args.length === 0 || args.includes('--sla');
const runApproval = args.length === 0 || args.includes('--approval');

(async () => {
  const start = Date.now();
  if (runSla) {
    const r = await checkSlaTimers();
    // eslint-disable-next-line no-console
    console.log('SLA sweep:', JSON.stringify(r, null, 2));
  }
  if (runApproval) {
    const r = await checkApprovalDeadlines();
    // eslint-disable-next-line no-console
    console.log('Approval deadline sweep:', JSON.stringify(r, null, 2));
  }
  // eslint-disable-next-line no-console
  console.log(`Total: ${Date.now() - start}ms`);
  await prisma.$disconnect();
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Sweep failed:', err);
  process.exit(1);
});
