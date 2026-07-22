/**
 * Zod query schemas for the Risk Management analytics endpoints. Kept separate
 * from risk.schema.ts so the Phase 1 request contracts stay untouched.
 */
import { z } from 'zod';

export const TrendQuerySchema = z.object({
  // Window length in whole months, ending with the current month.
  months: z.coerce.number().int().min(1).max(60).default(12),
  registerId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
});
export type TrendQuery = z.infer<typeof TrendQuerySchema>;

export const OverdueQuerySchema = z.object({
  registerId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type OverdueQuery = z.infer<typeof OverdueQuerySchema>;

export const ByCategoryQuerySchema = z.object({
  registerId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  // Closed risks are excluded by default — a Pareto of live exposure is the
  // useful chart; pass includeClosed=true for a lifetime view.
  includeClosed: z.coerce.boolean().default(false),
});
export type ByCategoryQuery = z.infer<typeof ByCategoryQuerySchema>;
