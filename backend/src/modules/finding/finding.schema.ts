import { z } from 'zod';
import { FindingSeverityEnum, FindingStatusEnum } from '../audit/audit.schema';

export const FindingIdParamSchema = z.object({ id: z.string() });
export const TicketIdParamSchema = z.object({ ticketId: z.string() });

// Manual finding create/edit (the fallback path — most findings auto-generate
// from checklist submissions).
export const FindingUpsertSchema = z.object({
  source_ticket_id: z.string(),
  source_stage_id: z.string().optional().nullable(),
  severity: FindingSeverityEnum,
  status: FindingStatusEnum.optional(),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(4000),
  recommendation: z.string().max(4000).optional().nullable(),
  reference: z.string().max(300).optional().nullable(),
  evidence: z.unknown().optional().nullable(),
});

export const FindingUpdateSchema = FindingUpsertSchema.partial().extend({
  // source_ticket_id is immutable once created.
  source_ticket_id: z.string().optional(),
});

// Per-module Findings register list (+ per-ticket filter).
export const ListFindingQuerySchema = z.object({
  workflow_type_id: z.string().optional(),
  source_ticket_id: z.string().optional(),
  status: FindingStatusEnum.optional(),
  severity: FindingSeverityEnum.optional(),
  department_id: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
});

// Raise a child ticket (CAPA or Deviation) from a finding.
export const RaiseChildSchema = z.object({
  child_type: z.enum(['CAPA', 'DEVIATION', 'RISK']),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(4000).optional().nullable(),
  owner_id: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  // CAPA only: corrective / preventive / both.
  capa_type: z.enum(['CORRECTIVE', 'PREVENTIVE', 'BOTH']).optional(),
});

export type FindingUpsertInput = z.infer<typeof FindingUpsertSchema>;
export type FindingUpdateInput = z.infer<typeof FindingUpdateSchema>;
export type ListFindingQuery = z.infer<typeof ListFindingQuerySchema>;
export type RaiseChildInput = z.infer<typeof RaiseChildSchema>;
