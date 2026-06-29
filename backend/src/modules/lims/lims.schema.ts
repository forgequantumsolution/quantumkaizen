import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const LabTypeEnum = z.enum(['INTERNAL', 'PARTNER', 'CONTRACT']);

export const ListLabsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  type: LabTypeEnum.optional(),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export const LabUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  type: LabTypeEnum.default('INTERNAL'),
  gmp_class: z.string().max(60).optional().nullable(),
  site_code: z.string().max(60).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  accreditation: z.string().max(300).optional().nullable(),
  contact_name: z.string().max(200).optional().nullable(),
  contact_email: z.string().email().max(200).optional().nullable().or(z.literal('')),
  is_active: z.boolean().optional(),
});

export type ListLabsQuery = z.infer<typeof ListLabsQuerySchema>;
export type LabUpsertInput = z.infer<typeof LabUpsertSchema>;
