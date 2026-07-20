import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import {
  AddCommentSchema,
  AttachDocSchema,
  HoldBodySchema,
  ListCommentsQuerySchema,
  ListTicketsQuerySchema,
  RaiseTicketSchema,
  SpawnChildSchema,
  TransitionBodySchema,
  UpdateTicketSchema,
} from './ticket.schema';

RaiseTicketSchema.openapi('RaiseTicketInput');
UpdateTicketSchema.openapi('UpdateTicketInput');
TransitionBodySchema.openapi('TransitionInput');
HoldBodySchema.openapi('HoldTicketInput');
AddCommentSchema.openapi('AddCommentInput');
AttachDocSchema.openapi('AttachDocInput');
SpawnChildSchema.openapi('SpawnChildInput');

const TicketSummary = z
  .object({
    id: z.string().uuid(),
    uniqueId: z.string(),
    title: z.string(),
    isOnHold: z.boolean(),
    isDeleted: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    priority: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
    department: z.object({ id: z.string().uuid(), name: z.string(), code: z.string() }).nullable(),
    createdBy: z.object({ id: z.string().uuid(), name: z.string(), email: z.string() }).nullable(),
    flows: z.array(z.unknown()),
  })
  .openapi('TicketSummary');

const TicketListResponse = z
  .object({
    items: z.array(TicketSummary),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  })
  .openapi('TicketListResponse');

const RaiseTicketResponse = z
  .object({
    ticketId: z.string().uuid(),
    flowId: z.string().uuid(),
    uniqueId: z.string(),
  })
  .openapi('RaiseTicketResponse');

const TransitionResponse = z
  .object({
    status: z.enum([
      'transitioned',
      'completed',
      'held',
      'returned',
      'reassigned',
      // Phase 3 — Approvals. `pending_approval`: the action's policy isn't yet
      // satisfied (enteredStages/exitedStages empty, isCompleted=false).
      'pending_approval',
      // Terminal rejection — a REJECT-behavior action or an approval rejection
      // stopped the ticket. exitedStages holds the cleared stages, isCompleted=true.
      'rejected',
    ]),
    ticketId: z.string().uuid(),
    flowId: z.string().uuid(),
    enteredStages: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    exitedStages: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    isCompleted: z.boolean(),
    approval: z
      .object({
        instanceId: z.string().uuid(),
        remaining: z
          .object({
            rolesRequired: z.number().int(),
            recordedApprovers: z.number().int(),
          })
          .optional(),
      })
      .optional()
      .describe('Present when status is pending_approval or rejected (via approval)'),
  })
  .openapi('TransitionResponse');

const idParam = z.object({ id: z.string().uuid() });

// CRUD
registry.registerPath({
  method: 'get',
  path: '/tickets',
  tags: ['Tickets'],
  summary: 'List tickets',
  security: [{ bearerAuth: [] }],
  request: { query: ListTicketsQuerySchema },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: TicketListResponse } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/tickets',
  tags: ['Tickets'],
  summary: 'Raise a ticket against an active workflow',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: RaiseTicketSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: RaiseTicketResponse } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'get',
  path: '/tickets/{id}',
  tags: ['Tickets'],
  summary: 'Get a ticket by id',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: { 200: { description: 'OK' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

registry.registerPath({
  method: 'patch',
  path: '/tickets/{id}',
  tags: ['Tickets'],
  summary: 'Update ticket header fields',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: UpdateTicketSchema } } },
  },
  responses: { 200: { description: 'OK' }, 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

registry.registerPath({
  method: 'delete',
  path: '/tickets/{id}',
  tags: ['Tickets'],
  summary: 'Soft-delete a ticket',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: { 204: { description: 'Deleted' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

// Engine
registry.registerPath({
  method: 'get',
  path: '/tickets/{id}/allowed-actions',
  tags: ['Tickets'],
  summary: 'Stage actions filtered by RBAC for the requester',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: { 200: { description: 'OK' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

registry.registerPath({
  method: 'post',
  path: '/tickets/{id}/transition',
  tags: ['Tickets'],
  summary: 'Perform a stage action — drives the engine',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: TransitionBodySchema } } },
  },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: TransitionResponse } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'post',
  path: '/tickets/{id}/hold',
  tags: ['Tickets'],
  summary: 'Universal hold (works at any stage)',
  security: [{ bearerAuth: [] }],
  request: { params: idParam, body: { content: { 'application/json': { schema: HoldBodySchema } } } },
  responses: { 204: { description: 'Held' }, 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409] },
});

registry.registerPath({
  method: 'post',
  path: '/tickets/{id}/resume',
  tags: ['Tickets'],
  summary: 'Resume a held ticket',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: { 204: { description: 'Resumed' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409] },
});

// Tracking / timeline
registry.registerPath({
  method: 'get',
  path: '/tickets/{id}/track',
  tags: ['Tickets'],
  summary: 'Stage tracking history (immutable)',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: { 200: { description: 'OK' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

registry.registerPath({
  method: 'get',
  path: '/tickets/{id}/timeline',
  tags: ['Tickets'],
  summary: 'Chronological timeline (stage events + comments)',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: { 200: { description: 'OK' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

registry.registerPath({
  method: 'get',
  path: '/tickets/{id}/participants',
  tags: ['Tickets'],
  summary: 'Distinct users who interacted with the ticket',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: { 200: { description: 'OK' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

// Comments
registry.registerPath({
  method: 'post',
  path: '/tickets/{id}/comments',
  tags: ['Tickets'],
  summary: 'Add a comment',
  security: [{ bearerAuth: [] }],
  request: { params: idParam, body: { content: { 'application/json': { schema: AddCommentSchema } } } },
  responses: { 201: { description: 'Created' }, 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

registry.registerPath({
  method: 'get',
  path: '/tickets/{id}/comments',
  tags: ['Tickets'],
  summary: 'List comments (paginated)',
  security: [{ bearerAuth: [] }],
  request: { params: idParam, query: ListCommentsQuerySchema },
  responses: { 200: { description: 'OK' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

registry.registerPath({
  method: 'delete',
  path: '/tickets/{id}/comments/{commentId}',
  tags: ['Tickets'],
  summary: 'Soft-delete a comment (own only unless admin)',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid(), commentId: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

// Docs
registry.registerPath({
  method: 'post',
  path: '/tickets/{id}/docs',
  tags: ['Tickets'],
  summary: 'Attach a document URL to the ticket',
  security: [{ bearerAuth: [] }],
  request: { params: idParam, body: { content: { 'application/json': { schema: AttachDocSchema } } } },
  responses: { 201: { description: 'Created' }, 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

registry.registerPath({
  method: 'get',
  path: '/tickets/{id}/docs',
  tags: ['Tickets'],
  summary: 'List ticket documents',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: { 200: { description: 'OK' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

registry.registerPath({
  method: 'delete',
  path: '/tickets/{id}/docs/{docId}',
  tags: ['Tickets'],
  summary: 'Soft-delete a ticket document',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid(), docId: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

// Spawn child
registry.registerPath({
  method: 'post',
  path: '/tickets/{id}/spawn-child',
  tags: ['Tickets'],
  summary: 'Spawn a child ticket against another workflow',
  security: [{ bearerAuth: [] }],
  request: { params: idParam, body: { content: { 'application/json': { schema: SpawnChildSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: RaiseTicketResponse } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});

