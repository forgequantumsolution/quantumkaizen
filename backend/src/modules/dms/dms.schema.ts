import { z } from 'zod';

export const DocumentTypeEnum = z.enum([
  'SOP',
  'POLICY',
  'PROTOCOL',
  'WORK_INSTRUCTION',
  'FORM_TEMPLATE',
  'MANUAL',
  'SPECIFICATION',
  'OTHER',
]);

export const DocumentStatusEnum = z.enum([
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'EFFECTIVE',
  'SUPERSEDED',
  'RETIRED',
]);

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
  status: DocumentStatusEnum.optional(),
  type: DocumentTypeEnum.optional(),
  search: z.string().optional(),
  // Effective documents due (or overdue) for periodic review within 30 days.
  review_due: z.coerce.boolean().optional(),
});

export const ContentTypeEnum = z.enum(['EDITOR', 'FILE']);

// Uploaded file (stored inline as a base64 data URL). ~8MB cap.
const MAX_FILE_DATA = 12_000_000; // base64 chars ≈ ~9MB binary
const fileFields = {
  file_name: z.string().max(300).optional().nullable(),
  file_mime: z.string().max(150).optional().nullable(),
  file_size: z.coerce.number().int().min(0).max(8 * 1024 * 1024).optional().nullable(),
  file_data: z.string().max(MAX_FILE_DATA).optional().nullable(),
};

export const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(300),
  type: DocumentTypeEnum.default('SOP'),
  description: z.string().max(2000).optional().nullable(),
  department_id: z.string().optional().nullable(),
  owner_id: z.string().optional().nullable(),
  // Initial content for the first draft version — editor HTML or an uploaded file.
  content_type: ContentTypeEnum.default('EDITOR'),
  content: z.string().optional().nullable(),
  ...fileFields,
});

export const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  type: DocumentTypeEnum.optional(),
  description: z.string().max(2000).optional().nullable(),
  department_id: z.string().optional().nullable(),
  owner_id: z.string().optional().nullable(),
});

// Save the working draft version — online editor HTML or an uploaded file.
export const SaveContentSchema = z.object({
  content_type: ContentTypeEnum.optional(),
  content: z.string().optional().nullable(),
  ...fileFields,
  change_summary: z.string().max(1000).optional().nullable(),
});

export const ReviseSchema = z.object({
  change_summary: z.string().max(1000).optional().nullable(),
});

export const IssueSchema = z.object({
  // Days until the next periodic review (defaults to 365 in service).
  review_period_days: z.coerce.number().int().min(1).max(3650).optional(),
});

export const SubmitSchema = z.object({});

// Approve to issue — re-authenticated e-signature (PIN or password).
export const ApproveSchema = z.object({
  credential: z.string().min(1),
  review_period_days: z.coerce.number().int().min(1).max(3650).optional(),
});

export const RejectSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const AssignReadersSchema = z.object({
  user_ids: z.array(z.string()).min(1),
});

export const MarkReviewedSchema = z.object({
  review_period_days: z.coerce.number().int().min(1).max(3650).optional(),
});

export type ListDocumentsQuery = z.infer<typeof ListDocumentsQuerySchema>;
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
export type SaveContentInput = z.infer<typeof SaveContentSchema>;
export type ReviseInput = z.infer<typeof ReviseSchema>;
export type IssueInput = z.infer<typeof IssueSchema>;
export type ApproveInput = z.infer<typeof ApproveSchema>;
export type RejectInput = z.infer<typeof RejectSchema>;
export type AssignReadersInput = z.infer<typeof AssignReadersSchema>;
export type MarkReviewedInput = z.infer<typeof MarkReviewedSchema>;
