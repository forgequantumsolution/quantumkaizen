import { z } from 'zod';

export const SpecStageEnum = z.enum(['RELEASE', 'STABILITY', 'IN_PROCESS', 'RAW_MATERIAL']);
export const SpecVersionStatusEnum = z.enum(['DRAFT', 'APPROVED', 'SUPERSEDED', 'RETIRED']);

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListSpecVersionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  stage: SpecStageEnum.optional(),
  status: SpecVersionStatusEnum.optional(),
  product_id: z.string().optional(),
});

export const SpecLineSchema = z.object({
  analyte_id: z.string().optional().nullable(),
  test_definition_id: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  unit: z.string().max(60).optional().nullable(),
  min_value: z.coerce.number().optional().nullable(),
  max_value: z.coerce.number().optional().nullable(),
  target_value: z.coerce.number().optional().nullable(),
  text_criteria: z.string().max(300).optional().nullable(),
  decimals: z.coerce.number().int().min(0).max(12).optional().nullable(),
  sig_figs: z.coerce.number().int().min(0).max(12).optional().nullable(),
  mandatory: z.boolean().default(true),
  sequence: z.coerce.number().int().min(0).optional(),
});

export const SpecVersionUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  product_id: z.string().optional().nullable(),
  specification_id: z.string().optional().nullable(),
  stage: SpecStageEnum.default('RELEASE'),
  grade: z.string().max(120).optional().nullable(),
  market: z.string().max(120).optional().nullable(),
  pharmacopoeia: z.string().max(60).optional().nullable(),
  lines: z.array(SpecLineSchema).default([]),
});

export type ListSpecVersionQuery = z.infer<typeof ListSpecVersionQuerySchema>;
export type SpecVersionUpsertInput = z.infer<typeof SpecVersionUpsertSchema>;
export type SpecLineInput = z.infer<typeof SpecLineSchema>;
