import { z } from 'zod';

export const AuditReviewQuerySchema = z.object({
  entity_type: z.string().optional(),
  action: z.string().optional(),
  user: z.string().optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  page_size: z.coerce.number().int().positive().max(500).optional(),
});

export type AuditReviewQuery = z.infer<typeof AuditReviewQuerySchema>;
