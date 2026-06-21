/**
 * CLI runner: spawn due audits from schedule rules once and exit.
 * No Redis dependency — hits Prisma directly. Same logic the worker runs on
 * the AUDIT_SCHEDULE_CRON cadence and the POST /audit/schedule-rules/run-now
 * endpoint triggers.
 *
 *   npm run audit:sweep
 */
import { prisma } from '../lib/prisma';
import { spawnDueAudits } from './sweeps/spawnDueAudits';

(async () => {
  const result = await spawnDueAudits();
  // eslint-disable-next-line no-console
  console.log('Audit schedule sweep:', JSON.stringify(result, null, 2));
  await prisma.$disconnect();
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Audit sweep failed:', err);
  process.exit(1);
});
