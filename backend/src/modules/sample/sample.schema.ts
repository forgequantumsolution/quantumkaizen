import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const SampleStatusEnum = z.enum(['REGISTERED', 'IN_TESTING', 'IN_REVIEW', 'RELEASED', 'REJECTED', 'CANCELLED']);
export const CustodyActionEnum = z.enum(['REGISTERED', 'RECEIVED', 'TRANSFERRED', 'STORED', 'ALIQUOTED', 'RETURNED', 'DISPOSED']);

// ── Storage locations ──
export const ListStorageQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});
export const StorageUpsertSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().max(60).optional().nullable(),
  temp_zone: z.string().max(60).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  is_active: z.boolean().optional(),
});

// ── Samples ──
export const ListSampleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
  status: SampleStatusEnum.optional(),
  lab_id: z.string().optional(),
  search: z.string().optional(),
});

export const RegisterSampleSchema = z.object({
  product_name: z.string().min(1).max(200),
  product_id: z.string().uuid().optional().nullable(), // LIMS 2.0 — link to Product master (drives panel + spec)
  batch_no: z.string().max(120).optional().nullable(),
  sample_type: z.string().max(80).optional().nullable(),
  source_site: z.string().max(200).optional().nullable(),
  specification_id: z.string().optional().nullable(),
  quantity: z.coerce.number().min(0).optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  collected_at: z.string().optional().nullable(),
  received_at: z.string().optional().nullable(),
  lab_id: z.string().optional().nullable(),
  current_location_id: z.string().optional().nullable(),
  priority: z.string().max(20).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(),
});

export const UpdateSampleSchema = RegisterSampleSchema.partial();

export const TransitionSampleSchema = z.object({
  status: SampleStatusEnum,
  remarks: z.string().max(1000).optional().nullable(),
});

export const AddCustodySchema = z.object({
  action: CustodyActionEnum,
  from_location_id: z.string().optional().nullable(),
  to_location_id: z.string().optional().nullable(),
  handler_name: z.string().max(200).optional().nullable(),
  occurred_at: z.string().optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(),
});

export const AddAliquotSchema = z.object({
  code: z.string().max(40).optional().nullable(),
  storage_location_id: z.string().optional().nullable(),
  temp_zone: z.string().max(60).optional().nullable(),
  quantity: z.coerce.number().min(0).optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  expiry_at: z.string().optional().nullable(),
});

export type ListStorageQuery = z.infer<typeof ListStorageQuerySchema>;
export type StorageUpsertInput = z.infer<typeof StorageUpsertSchema>;
export type ListSampleQuery = z.infer<typeof ListSampleQuerySchema>;
export type RegisterSampleInput = z.infer<typeof RegisterSampleSchema>;
export type UpdateSampleInput = z.infer<typeof UpdateSampleSchema>;
export type TransitionSampleInput = z.infer<typeof TransitionSampleSchema>;
export type AddCustodyInput = z.infer<typeof AddCustodySchema>;
export type AddAliquotInput = z.infer<typeof AddAliquotSchema>;
