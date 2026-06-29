import { z } from 'zod';

export const ListSupplierQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const SupplierUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  contact_name: z.string().max(150).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  is_active: z.boolean().optional(),
});

export type ListSupplierQuery = z.infer<typeof ListSupplierQuerySchema>;
export type SupplierUpsertInput = z.infer<typeof SupplierUpsertSchema>;
