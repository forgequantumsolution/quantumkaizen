import { z } from 'zod';

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  search: z.string().optional(),
  module: z.string().optional(),
  grouped: z.enum(['true', 'false']).optional(),
});

export type ListQuery = z.infer<typeof ListQuerySchema>;
