import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().min(1) });

export const ConditionSchema = z.object({
  name: z.string().min(1),
  temp_zone: z.string().optional().nullable(),
  storage_location_id: z.string().optional().nullable(),
  orientation: z.string().optional().nullable(),
});

export const ListStudyQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
});

export const StudyUpsertSchema = z.object({
  product_name: z.string().min(1),
  product_id: z.string().optional().nullable(),
  batch_no: z.string().optional().nullable(),
  title: z.string().min(1),
  spec_version_id: z.string().optional().nullable(),
  packaging: z.string().optional().nullable(),
  timepoints_months: z.string().optional().nullable(),
  conditions: z.array(ConditionSchema).optional(),
});

export const ActivateSchema = z.object({ start_date: z.string().optional().nullable() });

export type ConditionInput = z.infer<typeof ConditionSchema>;
export type ListStudyQuery = z.infer<typeof ListStudyQuerySchema>;
export type StudyUpsertInput = z.infer<typeof StudyUpsertSchema>;
