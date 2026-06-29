/**
 * Sweep: spawn DRAFT audit registers from any schedule rule whose nextRunAt is
 * due, then advance each rule's nextRunAt. Pure Prisma — no Redis dependency,
 * so it also runs via `npm run audit:sweep` and the POST /run-now endpoint.
 */
import { spawnDueAudits as run } from '../../modules/audit/audit-schedule.service';

export const spawnDueAudits = () => run();
