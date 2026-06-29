/**
 * Sweep: flag effective documents past their periodic-review due date. Pure
 * Prisma; runs on the worker cron tick (alongside the audit-schedule sweep) and
 * via `npm run audit:sweep`.
 */
import { flagOverdueReviews as run } from '../../modules/dms/dms.service';

export const flagOverdueReviews = () => run();
