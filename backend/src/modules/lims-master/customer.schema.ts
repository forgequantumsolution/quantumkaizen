import { z } from 'zod';

export const ListCustomerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const CustomerUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  contact_name: z.string().max(150).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  is_active: z.boolean().optional(),
});

export type ListCustomerQuery = z.infer<typeof ListCustomerQuerySchema>;
export type CustomerUpsertInput = z.infer<typeof CustomerUpsertSchema>;
