import { z } from 'zod';

export const ListProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const ProductUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  grade: z.string().max(120).optional().nullable(),
  dosage_form: z.string().max(120).optional().nullable(),
  strength: z.string().max(120).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  markets: z.string().max(500).optional().nullable(),
  default_panel_id: z.string().uuid().optional().nullable(), // LIMS 2.0 — panel auto-attached at sample login
  is_active: z.boolean().optional(),
});

export type ListProductQuery = z.infer<typeof ListProductQuerySchema>;
export type ProductUpsertInput = z.infer<typeof ProductUpsertSchema>;
