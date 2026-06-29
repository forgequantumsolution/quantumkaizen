import { z } from 'zod';

export const ListUnitQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const UnitUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  symbol: z.string().max(60).optional().nullable(),
  kind: z.string().max(60).optional().nullable(),
  is_active: z.boolean().optional(),
});

export type ListUnitQuery = z.infer<typeof ListUnitQuerySchema>;
export type UnitUpsertInput = z.infer<typeof UnitUpsertSchema>;
