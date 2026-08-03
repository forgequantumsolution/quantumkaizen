import { z } from 'zod';

/** Query params for the Quality Command Center overview. */
export const OverviewQuerySchema = z.object({
  /** Time window for trends/KPIs. */
  range: z.enum(['7d', '30d', '90d', '1y', '3y']).default('30d'),
  /** Optional site scope. Ignored if the user isn't allowed to see it. */
  siteId: z.string().uuid().optional(),
  /**
   * Calendar year to report "as of". Omitted or the current year → live
   * figures. A past year anchors every panel to 31 Dec of that year and
   * excludes records created after it, so the dashboard shows what the
   * programme looked like then rather than today's numbers under an old label.
   */
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type OverviewQuery = z.infer<typeof OverviewQuerySchema>;
