import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().min(1) });

export const ListQcMaterialQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const QcMaterialUpsertSchema = z.object({
  name: z.string().min(1),
  analyte_name: z.string().optional().nullable(),
  method_id: z.string().optional().nullable(),
  lot_no: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  target_mean: z.number().optional().nullable(),
  target_sd: z.number().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const RecordQcResultSchema = z.object({
  value: z.number(),
  analyst_name: z.string().optional().nullable(),
  instrument_id: z.string().optional().nullable(),
  measured_at: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export type ListQcMaterialQuery = z.infer<typeof ListQcMaterialQuerySchema>;
export type QcMaterialUpsertInput = z.infer<typeof QcMaterialUpsertSchema>;
export type RecordQcResultInput = z.infer<typeof RecordQcResultSchema>;
