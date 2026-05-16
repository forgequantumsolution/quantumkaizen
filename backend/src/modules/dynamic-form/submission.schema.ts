import { z } from 'zod';

export const SubmitFormSchema = z.object({
  responses: z.record(z.any()),
  meta: z.record(z.any()).optional().nullable(),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED']).optional(),
});

export const UpdateSubmissionStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED']),
});

export const ListSubmissionsQuerySchema = z.object({
  form_id: z.string().optional(),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  submitted_by: z.string().optional(),
  ticket_id: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
});

export const FormIdParamSchema = z.object({ formId: z.string() });
export const SubmissionIdParamSchema = z.object({ id: z.string() });

export type SubmitFormInput = z.infer<typeof SubmitFormSchema>;
export type UpdateSubmissionStatusInput = z.infer<typeof UpdateSubmissionStatusSchema>;
export type ListSubmissionsQuery = z.infer<typeof ListSubmissionsQuerySchema>;
