import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().min(1) });

export const OpenInvestigationSchema = z.object({
  title: z.string().min(1),
  sample_id: z.string().optional().nullable(),
  sample_test_id: z.string().optional().nullable(),
  result_id: z.string().optional().nullable(),
});

export const ListInvestigationQuerySchema = z.object({
  status: z.string().optional(),
  phase: z.string().optional(),
  sample_id: z.string().optional(),
  search: z.string().optional(),
  page_size: z.coerce.number().int().positive().max(500).optional(),
});

export const UpdateInvestigationSchema = z.object({
  title: z.string().optional(),
  hypothesis: z.string().optional().nullable(),
  investigation_summary: z.string().optional().nullable(),
  retest_required: z.boolean().optional(),
  resample_required: z.boolean().optional(),
  classification: z.string().optional().nullable(),
});

export const AdvancePhaseSchema = z.object({
  phase: z.enum(['PHASE_1B', 'PHASE_2', 'CLOSED']),
  investigation_summary: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const CloseInvestigationSchema = z.object({
  classification: z.enum(['LAB_ERROR', 'NON_LAB_ERROR', 'CONFIRMED_OOS', 'INVALIDATED']),
  conclusion: z.string().optional().nullable(),
  capa_id: z.string().optional().nullable(),
  credential: z.string().optional(),
});

export type OpenInvestigationInput = z.infer<typeof OpenInvestigationSchema>;
export type ListInvestigationQuery = z.infer<typeof ListInvestigationQuerySchema>;
export type UpdateInvestigationInput = z.infer<typeof UpdateInvestigationSchema>;
export type AdvancePhaseInput = z.infer<typeof AdvancePhaseSchema>;
export type CloseInvestigationInput = z.infer<typeof CloseInvestigationSchema>;
