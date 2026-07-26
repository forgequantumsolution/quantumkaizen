import { z } from 'zod';

export const TicketClassificationSchema = z.enum([
  'PRODUCT',
  'PROCESS',
  'SYSTEM',
  'EQUIPMENT',
  'DOCUMENTATION',
  'TRAINING',
  'OTHER',
]);

export const RaiseTicketSchema = z.object({
  workflowId: z.string().uuid(),
  title: z.string().min(1).max(250),
  description: z.string().max(5000).optional(),
  ticketReason: z.string().max(2000).optional(),
  priorityId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  severityId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  classification: TicketClassificationSchema.optional().nullable(),
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
  severityId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  classification: TicketClassificationSchema.optional().nullable(),
  customFields: z.record(z.unknown()).optional(),
});

export const ListTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  workflowId: z.string().uuid().optional(),
  workflowTypeId: z.string().uuid().optional(),
  // Navbar site selection. Narrows the list to one site; ignored (never widens)
  // if the caller isn't allowed to see it. Omit for the caller's full scope.
  siteId: z.string().uuid().optional(),
  // Filter by responsible individual. A user id narrows to their tickets;
  // the literal 'unassigned' narrows to tickets with no assignee.
  assigneeId: z.union([z.string().uuid(), z.literal('unassigned')]).optional(),
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

  // Phase 3 — approval intercept fields. When the (stage, action) has an
  // ApprovalPolicy, the engine's approval layer reads these:
  //   - Omitted        → defaults to APPROVED (the happy path)
  //   - 'APPROVED'     → records an APPROVED vote; if the policy is now
  //                      satisfied, falls through to the existing behavior
  //                      dispatch; otherwise returns status='pending_approval'.
  //   - 'REJECTED'     → records a REJECTED vote. If the policy is now
  //                      unsatisfiable (ALL_REQUIRED / SEQUENTIAL with one no),
  //                      the instance flips REJECTED and we return
  //                      status='approval_rejected'. **Ticket stays in stage**
  //                      (Q5 signed-off 2026-05-12) — to walk the ticket back,
  //                      invoke a separate REJECT-behavior action.
  // `approvalComment` is captured on the record. If omitted, `remarks` is
  // used as a fallback so legacy callers don't need to change.
  approvalDecision: z.enum(['APPROVED', 'REJECTED']).optional(),
  approvalComment: z.string().max(2000).optional(),
});

export const AssignTicketSchema = z.object({
  // null / omitted clears the assignment.
  assigneeId: z.string().uuid().nullable().optional(),
  note: z.string().max(2000).optional(),
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
export type AssignTicketInput = z.infer<typeof AssignTicketSchema>;
export type ListTicketsQuery = z.infer<typeof ListTicketsQuerySchema>;
export type TransitionBody = z.infer<typeof TransitionBodySchema>;
export type HoldBody = z.infer<typeof HoldBodySchema>;
export type AddCommentInput = z.infer<typeof AddCommentSchema>;
export type ListCommentsQuery = z.infer<typeof ListCommentsQuerySchema>;
export type AttachDocInput = z.infer<typeof AttachDocSchema>;
export type SpawnChildInput = z.infer<typeof SpawnChildSchema>;
