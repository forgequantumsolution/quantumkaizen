import { z } from 'zod';

const SubClauseSchema = z.object({
  id: z.string().optional(),
  sub_clause_number: z.string(),
  sub_clause_title: z.string(),
  requirement_text: z.string().optional().nullable(),
  position: z.number().int().optional(),
});

const ClauseSchema = z.object({
  id: z.string().optional(),
  clause_number: z.string(),
  clause_title: z.string(),
  position: z.number().int().optional(),
  sub_clauses: z.array(SubClauseSchema).default([]),
});

export const IsoUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  remarks: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
  clauses: z.array(ClauseSchema).default([]),
});

export const ListIsoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  _t: z.string().optional(),
});

const NamedRefSchema = z.object({ id: z.union([z.string(), z.number()]), name: z.string() });

export const AuditScheduleUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  plant: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  audit_date: z.string(),
  previous_audit_date: z.string().optional().nullable(),
  financial_year: z.string().optional().nullable(),
  audit_method: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  locations: z.array(NamedRefSchema).optional(),
  main_processes: z.array(NamedRefSchema).optional(),
  sub_processes: z.array(NamedRefSchema).optional(),
  criteria: z.array(NamedRefSchema).optional(),
  departments: z.array(NamedRefSchema).optional(),
  focus_areas: z.array(NamedRefSchema).optional(),
});

export const ListAuditQuerySchema = z.object({
  title: z.string().optional(),
  location_id: z.string().optional(),
  financial_year: z.string().optional(),
});

export const UpdateAuditDateSchema = z.object({
  audit_date: z.string(),
});

export const IdParamSchema = z.object({ id: z.string() });
export const ScheduleIdParamSchema = z.object({ scheduleId: z.string() });

export type IsoUpsertInput = z.infer<typeof IsoUpsertSchema>;
export type ListIsoQuery = z.infer<typeof ListIsoQuerySchema>;
export type AuditScheduleUpsertInput = z.infer<typeof AuditScheduleUpsertSchema>;
export type ListAuditQuery = z.infer<typeof ListAuditQuerySchema>;
export type UpdateAuditDateInput = z.infer<typeof UpdateAuditDateSchema>;
