import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().min(1) });
export const TokenParamSchema = z.object({ token: z.string().min(1) });

export const ListTemplateQuerySchema = z.object({ search: z.string().optional() });
export const CoaTemplateUpsertSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional().nullable(),
  header_html: z.string().optional().nullable(),
  footer_html: z.string().optional().nullable(),
  sections: z.array(z.string()).optional(),
  customer_id: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const ListCoaQuerySchema = z.object({
  status: z.string().optional(),
  sample_id: z.string().optional(),
  search: z.string().optional(),
});
export const GenerateCoaSchema = z.object({
  sample_id: z.string().min(1),
  template_id: z.string().optional().nullable(),
  customer_id: z.string().optional().nullable(),
  conclusion: z.string().optional().nullable(),
});
export const IssueCoaSchema = z.object({
  credential: z.string().optional(),
  // Release despite unresolved unacceptable risk on the batch, its product or
  // its supplier. Requires `risk.override_gate`; the reason is written to the
  // trail against the CoA and stays with the record (EU GMP Annex 16).
  riskGateOverride: z.boolean().optional(),
  riskOverrideReason: z.string().max(1000).optional().nullable(),
});
export const RevokeCoaSchema = z.object({ reason: z.string().optional().nullable(), credential: z.string().optional() });

export type ListTemplateQuery = z.infer<typeof ListTemplateQuerySchema>;
export type CoaTemplateUpsertInput = z.infer<typeof CoaTemplateUpsertSchema>;
export type ListCoaQuery = z.infer<typeof ListCoaQuerySchema>;
export type GenerateCoaInput = z.infer<typeof GenerateCoaSchema>;
export type IssueCoaInput = z.infer<typeof IssueCoaSchema>;
export type RevokeCoaInput = z.infer<typeof RevokeCoaSchema>;
