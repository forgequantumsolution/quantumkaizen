/**
 * BullMQ worker — separate Node entry point.
 *
 *   npm run worker
 *
 * Boots two BullMQ Workers:
 *   - `sla-sweep`         processes `check-sla-timers` jobs (cron: SLA_SWEEP_CRON)
 *   - `approval-deadline` processes `check-approval-deadlines` jobs (cron: APPROVAL_DEADLINE_CRON)
 *
 * At boot, the worker schedules **repeating** jobs against each queue using
 * BullMQ's `Queue.add(..., { repeat: { pattern } })` API. Repeat keys are
 * fixed strings so re-running the worker won't accumulate duplicates.
 *
 * Graceful behaviour when REDIS_URL is unset:
 *   - logs a clear message
 *   - exits with code 0 (so a `restart on failure` orchestrator doesn't loop)
 *
 * Graceful shutdown:
 *   - SIGINT / SIGTERM → close both Workers + both Queues + Redis → exit 0
 *
 * In production the worker runs as a separate Render service (or k8s Deployment),
 * NOT inside the API process. The API never touches Redis.
 */
import { Worker, type Job } from 'bullmq';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { checkSlaTimers } from './sweeps/checkSlaTimers';
import { checkApprovalDeadlines } from './sweeps/checkApprovalDeadlines';
import {
  APPROVAL_DEADLINE_JOB,
  APPROVAL_DEADLINE_QUEUE,
  AUDIT_SCHEDULE_JOB,
  AUDIT_SCHEDULE_QUEUE,
  closeAll,
  getApprovalDeadlineQueue,
  getAuditScheduleQueue,
  getConnection,
  getSlaSweepQueue,
  SLA_SWEEP_JOB,
  SLA_SWEEP_QUEUE,
} from './queue';
import { spawnDueAudits } from './sweeps/spawnDueAudits';

const log = (msg: string, extra?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.info(`[worker] ${msg}`, extra ? JSON.stringify(extra) : '');
};
const err = (msg: string, extra?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] ${msg}`, extra ? JSON.stringify(extra) : '');
};

(async () => {
  const conn = getConnection();
  if (!conn) {
    log('REDIS_URL not set — worker not starting. Set REDIS_URL or use `npm run sla:sweep` for ad-hoc runs.');
    process.exit(0);
  }

  log(`booting; SLA cron=${env.SLA_SWEEP_CRON} approval cron=${env.APPROVAL_DEADLINE_CRON}`);

  // ── Schedule repeating jobs (idempotent — same `repeat.key` won't duplicate) ──
  const slaQueue = getSlaSweepQueue();
  const approvalQueue = getApprovalDeadlineQueue();
  const auditScheduleQueue = getAuditScheduleQueue();
  if (!slaQueue || !approvalQueue || !auditScheduleQueue) {
    err('Queue construction failed despite Redis connection present — bailing.');
    process.exit(1);
  }

  await slaQueue.add(
    SLA_SWEEP_JOB,
    {},
    {
      repeat: { pattern: env.SLA_SWEEP_CRON, key: 'sla-sweep-cron' },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  );
  await approvalQueue.add(
    APPROVAL_DEADLINE_JOB,
    {},
    {
      repeat: { pattern: env.APPROVAL_DEADLINE_CRON, key: 'approval-deadline-cron' },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  );
  await auditScheduleQueue.add(
    AUDIT_SCHEDULE_JOB,
    {},
    {
      repeat: { pattern: env.AUDIT_SCHEDULE_CRON, key: 'audit-schedule-cron' },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  );

  // ── Workers ──
  const slaWorker = new Worker(
    SLA_SWEEP_QUEUE,
    async (job: Job) => {
      log(`processing ${job.name} id=${job.id}`);
      const result = await checkSlaTimers();
      return result;
    },
    { connection: conn, concurrency: 1 },
  );
  slaWorker.on('completed', (job, result) =>
    log(`sla job ${job.id} complete`, result as Record<string, unknown>),
  );
  slaWorker.on('failed', (job, e) =>
    err(`sla job ${job?.id} failed`, { error: e.message }),
  );

  const approvalWorker = new Worker(
    APPROVAL_DEADLINE_QUEUE,
    async (job: Job) => {
      log(`processing ${job.name} id=${job.id}`);
      const result = await checkApprovalDeadlines();
      return result;
    },
    { connection: conn, concurrency: 1 },
  );
  approvalWorker.on('completed', (job, result) =>
    log(`approval-deadline job ${job.id} complete`, result as Record<string, unknown>),
  );
  approvalWorker.on('failed', (job, e) =>
    err(`approval-deadline job ${job?.id} failed`, { error: e.message }),
  );

  const auditScheduleWorker = new Worker(
    AUDIT_SCHEDULE_QUEUE,
    async (job: Job) => {
      log(`processing ${job.name} id=${job.id}`);
      const result = await spawnDueAudits();
      return result;
    },
    { connection: conn, concurrency: 1 },
  );
  auditScheduleWorker.on('completed', (job, result) =>
    log(`audit-schedule job ${job.id} complete`, result as Record<string, unknown>),
  );
  auditScheduleWorker.on('failed', (job, e) =>
    err(`audit-schedule job ${job?.id} failed`, { error: e.message }),
  );

  log('workers running; press Ctrl+C to stop');

  // ── Graceful shutdown ──
  const shutdown = async (signal: string) => {
    log(`received ${signal}, shutting down…`);
    await slaWorker.close();
    await approvalWorker.close();
    await auditScheduleWorker.close();
    await closeAll();
    await prisma.$disconnect();
    log('shutdown complete');
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
})().catch((e) => {
  err('boot failed', { error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
