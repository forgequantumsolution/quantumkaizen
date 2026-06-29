import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const TestStatusEnum = z.enum(['DRAFT', 'APPROVED', 'RETIRED']);
export const AnalyteDataTypeEnum = z.enum(['NUMERIC', 'TEXT', 'BOOLEAN', 'TITRATION']);

// ── Test Definitions ──

export const ListTestDefinitionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  status: TestStatusEnum.optional(),
});

export const TestAnalyteSchema = z.object({
  analyte_id: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  unit: z.string().max(60).optional().nullable(),
  data_type: AnalyteDataTypeEnum.default('NUMERIC'),
  decimals: z.coerce.number().int().min(0).max(10).optional().nullable(),
  calculation: z.string().max(500).optional().nullable(),
  sequence: z.coerce.number().int().min(0).optional(),
});

export const TestDefinitionUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  technique: z.string().max(150).optional().nullable(),
  method_id: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  analytes: z.array(TestAnalyteSchema).default([]),
});

// ── Test Panels ──

export const ListTestPanelQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
});

export const TestPanelItemSchema = z.object({
  test_definition_id: z.string().min(1),
  sequence: z.coerce.number().int().min(0).optional(),
});

export const TestPanelUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  items: z.array(TestPanelItemSchema).default([]),
});

export type ListTestDefinitionQuery = z.infer<typeof ListTestDefinitionQuerySchema>;
export type TestDefinitionUpsertInput = z.infer<typeof TestDefinitionUpsertSchema>;
export type ListTestPanelQuery = z.infer<typeof ListTestPanelQuerySchema>;
export type TestPanelUpsertInput = z.infer<typeof TestPanelUpsertSchema>;
