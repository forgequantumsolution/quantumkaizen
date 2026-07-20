import { z } from 'zod';

/** Query params for the Quality Command Center overview. */
export const OverviewQuerySchema = z.object({
  /** Time window for trends/KPIs. */
  range: z.enum(['7d', '30d', '90d', '1y', '3y']).default('30d'),
  /** Optional site scope. Ignored if the user isn't allowed to see it. */
  siteId: z.string().uuid().optional(),
});

export type OverviewQuery = z.infer<typeof OverviewQuerySchema>;
