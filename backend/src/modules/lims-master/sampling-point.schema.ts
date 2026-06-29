import { z } from 'zod';

export const ListSamplingPointQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const SamplingPointUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  area: z.string().max(150).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export type ListSamplingPointQuery = z.infer<typeof ListSamplingPointQuerySchema>;
export type SamplingPointUpsertInput = z.infer<typeof SamplingPointUpsertSchema>;
