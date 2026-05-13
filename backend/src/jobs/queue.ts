/**
 * BullMQ queue + Redis-connection factories.
 *
 * Two queues — `slaSweepQueue` and `approvalDeadlineQueue` — each backed by
 * the same Redis instance (configured via `REDIS_URL`). Jobs in each queue
 * are repeating cron jobs with the cadence configured via env vars:
 *
 *   SLA_SWEEP_CRON         (default: every 15 min)
 *   APPROVAL_DEADLINE_CRON (default: every 30 min)
 *
 * The worker process is a separate Node entry point — `npm run worker`. The
 * API process never imports this file, so it never connects to Redis.
 *
 * Graceful behaviour when Redis is unset/unreachable:
 *   - `getConnection()` returns `null` if REDIS_URL is unset
 *   - `worker.ts` checks for null and exits with a clear message
 */
import { Queue } from 'bullmq';
import IORedis, { type RedisOptions } from 'ioredis';
import { env } from '../config/env';

// BullMQ requires these specific Redis settings — see bullmq docs.
const baseRedisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

let _connection: IORedis | null = null;

/**
 * Lazy Redis connection singleton. Returns `null` if REDIS_URL is unset so
 * the worker can decline to start without erroring out.
 */
export const getConnection = (): IORedis | null => {
  if (!env.REDIS_URL) return null;
  if (_connection) return _connection;
  _connection = new IORedis(env.REDIS_URL, baseRedisOptions);
  return _connection;
};

export const SLA_SWEEP_QUEUE = 'sla-sweep';
export const APPROVAL_DEADLINE_QUEUE = 'approval-deadline';

export const SLA_SWEEP_JOB = 'check-sla-timers';
export const APPROVAL_DEADLINE_JOB = 'check-approval-deadlines';

let _slaQueue: Queue | null = null;
let _approvalQueue: Queue | null = null;

export const getSlaSweepQueue = (): Queue | null => {
  const conn = getConnection();
  if (!conn) return null;
  if (_slaQueue) return _slaQueue;
  _slaQueue = new Queue(SLA_SWEEP_QUEUE, { connection: conn });
  return _slaQueue;
};

export const getApprovalDeadlineQueue = (): Queue | null => {
  const conn = getConnection();
  if (!conn) return null;
  if (_approvalQueue) return _approvalQueue;
  _approvalQueue = new Queue(APPROVAL_DEADLINE_QUEUE, { connection: conn });
  return _approvalQueue;
};

/**
 * Close all open queue + connection handles. Used in worker.ts shutdown so
 * the process exits cleanly on SIGINT/SIGTERM.
 */
export const closeAll = async (): Promise<void> => {
  if (_slaQueue) {
    await _slaQueue.close();
    _slaQueue = null;
  }
  if (_approvalQueue) {
    await _approvalQueue.close();
    _approvalQueue = null;
  }
  if (_connection) {
    await _connection.quit();
    _connection = null;
  }
};
