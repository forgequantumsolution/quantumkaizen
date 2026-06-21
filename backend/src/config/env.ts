import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),
  // Phase 3 — BullMQ worker. Optional: when unset, `npm run worker` logs +
  // exits gracefully. The API process never connects to Redis.
  REDIS_URL: z.string().optional(),
  // Override the default 15-min / 30-min cron cadences for dev/test runs.
  // Standard 5-field crontab.
  SLA_SWEEP_CRON: z.string().default('*/15 * * * *'),
  APPROVAL_DEADLINE_CRON: z.string().default('*/30 * * * *'),
  // Audit schedule recurrence sweep — spawns due audits from schedule rules.
  AUDIT_SCHEDULE_CRON: z.string().default('0 1 * * *'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
