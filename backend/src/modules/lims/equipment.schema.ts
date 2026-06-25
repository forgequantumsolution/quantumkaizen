import { z } from 'zod';

export const EquipmentStatusEnum = z.enum(['ACTIVE', 'OUT_OF_SERVICE', 'RETIRED']);
export const CalibrationResultEnum = z.enum(['PASS', 'FAIL', 'CONDITIONAL']);

export const ListEquipmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  status: EquipmentStatusEnum.optional(),
  lab_id: z.string().optional(),
  search: z.string().optional(),
  // Equipment whose calibration is due/overdue within 30 days.
  calibration_due: z.coerce.boolean().optional(),
});

export const EquipmentUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  lab_id: z.string().optional().nullable(),
  serial_no: z.string().max(120).optional().nullable(),
  manufacturer: z.string().max(150).optional().nullable(),
  model: z.string().max(150).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  status: EquipmentStatusEnum.optional(),
  calibration_frequency_days: z.coerce.number().int().min(1).max(3650).optional().nullable(),
});

export const RecordCalibrationSchema = z.object({
  calibrated_at: z.string(),
  result: CalibrationResultEnum.default('PASS'),
  certificate_no: z.string().max(150).optional().nullable(),
  next_due_at: z.string().optional().nullable(),
  performed_by: z.string().max(200).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(),
});

export type ListEquipmentQuery = z.infer<typeof ListEquipmentQuerySchema>;
export type EquipmentUpsertInput = z.infer<typeof EquipmentUpsertSchema>;
export type RecordCalibrationInput = z.infer<typeof RecordCalibrationSchema>;
