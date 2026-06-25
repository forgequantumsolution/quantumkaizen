import { z } from 'zod';

export const ListAnalyteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const AnalyteUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  default_unit: z.string().max(60).optional().nullable(),
  data_type: z.enum(['NUMERIC', 'TEXT', 'BOOLEAN']).default('NUMERIC'),
  category: z.string().max(120).optional().nullable(),
  is_active: z.boolean().optional(),
});

export type ListAnalyteQuery = z.infer<typeof ListAnalyteQuerySchema>;
export type AnalyteUpsertInput = z.infer<typeof AnalyteUpsertSchema>;
