import { z } from 'zod';

export const RaiseTicketSchema = z.object({
  workflowId: z.string().uuid(),
  title: z.string().min(1).max(250),
  description: z.string().max(5000).optional(),
  ticketReason: z.string().max(2000).optional(),
  priorityId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  parentTicketId: z.string().uuid().optional().nullable(),
  parentTicketStageId: z.string().uuid().optional().nullable(),
  customFields: z.record(z.unknown()).optional(),
});

export const UpdateTicketSchema = z.object({
  title: z.string().min(1).max(250).optional(),
  description: z.string().max(5000).optional().nullable(),
  ticketReason: z.string().max(2000).optional().nullable(),
  priorityId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  customFields: z.record(z.unknown()).optional(),
});

export const ListTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  workflowId: z.string().uuid().optional(),
  status: z.enum(['open', 'completed', 'all']).optional().default('all'),
  mine: z.enum(['true', 'false']).optional().default('false'),
  includeDeleted: z.enum(['true', 'false']).optional().default('false'),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const CommentIdParamSchema = z.object({
  id: z.string().uuid(),
  commentId: z.string().uuid(),
});

export const DocIdParamSchema = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
});

export const TransitionBodySchema = z.object({
  actionId: z.string().uuid(),
  remarks: z.string().max(2000).optional(),
  returnToStageId: z.string().uuid().optional(),
  reassignToUserId: z.string().uuid().optional(),
  reassignToRoleId: z.string().uuid().optional(),
});

export const HoldBodySchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const AddCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const ListCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export const AttachDocSchema = z.object({
  fileUrl: z.string().min(1).max(2000),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  docType: z.enum(['ATTACHMENT', 'EVIDENCE', 'REPORT', 'FORM_SUBMISSION', 'OTHER']).optional(),
  stageId: z.string().uuid().optional(),
});

export const SpawnChildSchema = z.object({
  childWorkflowId: z.string().uuid(),
  parentStageId: z.string().uuid().optional(),
  title: z.string().min(1).max(250),
  description: z.string().max(5000).optional(),
});

export type RaiseTicketInput = z.infer<typeof RaiseTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof ListTicketsQuerySchema>;
export type TransitionBody = z.infer<typeof TransitionBodySchema>;
export type HoldBody = z.infer<typeof HoldBodySchema>;
export type AddCommentInput = z.infer<typeof AddCommentSchema>;
export type ListCommentsQuery = z.infer<typeof ListCommentsQuerySchema>;
export type AttachDocInput = z.infer<typeof AttachDocSchema>;
export type SpawnChildInput = z.infer<typeof SpawnChildSchema>;
