import { z } from 'zod';

export const SpecStatusEnum = z.enum(['DRAFT', 'APPROVED', 'RETIRED']);

export const ListSpecQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  status: SpecStatusEnum.optional(),
});

export const SpecParameterSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().max(60).optional().nullable(),
  min_value: z.coerce.number().optional().nullable(),
  max_value: z.coerce.number().optional().nullable(),
  target_value: z.coerce.number().optional().nullable(),
  text_criteria: z.string().max(300).optional().nullable(),
  method_id: z.string().optional().nullable(),
  pharmacopoeia_ref: z.string().max(150).optional().nullable(),
  position: z.coerce.number().int().min(0).optional(),
});

export const SpecUpsertSchema = z.object({
  product_name: z.string().min(1).max(200),
  pharmacopoeia: z.string().max(60).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  iso_standard_id: z.string().optional().nullable(),
  parameters: z.array(SpecParameterSchema).default([]),
});

export type ListSpecQuery = z.infer<typeof ListSpecQuerySchema>;
export type SpecUpsertInput = z.infer<typeof SpecUpsertSchema>;
