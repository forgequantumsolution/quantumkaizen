import { z } from 'zod';

export const ListMethodQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const MethodUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  technique: z.string().max(120).optional().nullable(),
  sop_ref: z.string().max(150).optional().nullable(),
  document_id: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  default_unit: z.string().max(60).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  is_active: z.boolean().optional(),
});

export type ListMethodQuery = z.infer<typeof ListMethodQuerySchema>;
export type MethodUpsertInput = z.infer<typeof MethodUpsertSchema>;
