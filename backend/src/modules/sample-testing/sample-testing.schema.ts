import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().min(1) });

export const AssignTestsSchema = z.object({
  test_definition_ids: z.array(z.string()).optional(),
  panel_id: z.string().optional().nullable(),
  from_product: z.boolean().optional(), // pull the product's default panel
});

export const ListSampleTestQuerySchema = z.object({
  sample_id: z.string().optional(),
  worklist_id: z.string().optional(),
  unassigned: z.coerce.boolean().optional(), // W-3 — tests not on any worklist
  status: z.string().optional(),
  review_status: z.string().optional(),
  page_size: z.coerce.number().int().positive().max(500).optional(),
});

export const EnterResultsSchema = z.object({
  analyst_name: z.string().optional().nullable(),
  instrument_id: z.string().optional().nullable(),
  results: z.array(z.object({
    result_id: z.string().min(1),
    numeric_value: z.number().optional().nullable(),
    text_value: z.string().optional().nullable(),
  })).min(1),
});

export const StartTestSchema = z.object({
  analyst_name: z.string().optional().nullable(),
  instrument_id: z.string().optional().nullable(),
});

export const ReviewTestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().optional().nullable(),
  credential: z.string().optional(), // e-signature credential
});

export const DisposeSampleSchema = z.object({
  disposition: z.enum(['RELEASED', 'REJECTED']),
  reason: z.string().optional().nullable(),
  credential: z.string().optional(),
});

export const ListWorklistQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
});

export const WorklistUpsertSchema = z.object({
  name: z.string().min(1),
  analyst_name: z.string().optional().nullable(),
  instrument_id: z.string().optional().nullable(),
  system_suitability: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.string().optional(),
  sample_test_ids: z.array(z.string()).optional(),
});

export type AssignTestsInput = z.infer<typeof AssignTestsSchema>;
export type ListSampleTestQuery = z.infer<typeof ListSampleTestQuerySchema>;
export type StartTestInput = z.infer<typeof StartTestSchema>;
export type EnterResultsInput = z.infer<typeof EnterResultsSchema>;
export type ReviewTestInput = z.infer<typeof ReviewTestSchema>;
export type DisposeSampleInput = z.infer<typeof DisposeSampleSchema>;
export type ListWorklistQuery = z.infer<typeof ListWorklistQuerySchema>;
export type WorklistUpsertInput = z.infer<typeof WorklistUpsertSchema>;
