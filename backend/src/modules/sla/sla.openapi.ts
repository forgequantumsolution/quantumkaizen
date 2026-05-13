/**
 * OpenAPI registrations for the SLA module.
 * Pulled in by `backend/src/openapi/spec.ts` at boot.
 */
import { registry, z } from '../../openapi/registry';
import { errorResponses, PaginationMeta } from '../../openapi/common';
import {
  CreateSlaPolicySchema,
  DecideExtensionSchema,
  ExtensionStatusSchema,
  ListTimersQuerySchema,
  RequestExtensionSchema,
  SlaTimerStatusSchema,
  UpdateSlaPolicySchema,
  UpsertThresholdsSchema,
} from './sla.schema';

CreateSlaPolicySchema.openapi('CreateSlaPolicyInput', {
  example: {
    parentStageId: '00000000-0000-0000-0000-000000000001',
    duration: 14400,
    calendarId: '00000000-0000-0000-0000-000000000002',
    escalationWorkflowId: null,
    pauseOnHold: true,
    pauseOnExtensionPending: false,
    responsibleRoleIds: ['00000000-0000-0000-0000-000000000003'],
    responsibleUserIds: [],
  },
});

UpdateSlaPolicySchema.openapi('UpdateSlaPolicyInput', {
  example: { duration: 28800 },
});

UpsertThresholdsSchema.openapi('UpsertThresholdsInput', {
  example: {
    thresholds: [
      { name: 'warning', percentage: 50, targetSlaStageId: null, notifyRoleIds: [], notifyUserIds: [] },
      { name: 'critical', percentage: 75, targetSlaStageId: null, notifyRoleIds: [], notifyUserIds: [] },
    ],
  },
});

RequestExtensionSchema.openapi('RequestSlaExtensionInput', {
  example: { extensionSec: 3600, reason: 'Customer requested additional review time' },
});

DecideExtensionSchema.openapi('DecideSlaExtensionInput', {
  example: { decision: 'APPROVED' },
});

// ─── Response shapes ───────────────────────────────────────────────────────

const RoleRef = z.object({ id: z.string().uuid(), name: z.string() });
const UserRef = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});
const StageRef = z.object({
  id: z.string().uuid(),
  name: z.string(),
  canonicalId: z.string(),
});

const SlaThresholdResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  percentage: z.number(),
  targetSlaStageId: z.string().uuid().nullable(),
  targetSlaStage: StageRef.nullable(),
  notifyRoles: z.array(RoleRef),
  notifyUsers: z.array(UserRef),
});

const SlaPolicyResponse = z
  .object({
    id: z.string().uuid(),
    parentStageId: z.string().uuid(),
    duration: z.number().int(),
    calendarId: z.string().uuid().nullable(),
    escalationWorkflowId: z.string().uuid().nullable(),
    pauseOnHold: z.boolean(),
    pauseOnExtensionPending: z.boolean(),
    isDeleted: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    parentStage: StageRef.extend({
      workflow: z.object({ id: z.string().uuid(), name: z.string() }),
    }),
    calendar: z
      .object({ id: z.string().uuid(), name: z.string(), timezone: z.string() })
      .nullable(),
    escalationWorkflow: z
      .object({ id: z.string().uuid(), name: z.string() })
      .nullable(),
    responsibleRoles: z.array(RoleRef),
    responsibleUsers: z.array(UserRef),
    thresholds: z.array(SlaThresholdResponse),
  })
  .openapi('SlaPolicy');

const SlaTimerEventResponse = z.object({
  id: z.string().uuid(),
  eventType: z.enum([
    'STARTED',
    'PAUSED',
    'RESUMED',
    'THRESHOLD_HIT',
    'SLA_TRANSITION',
    'EXTENDED',
    'COMPLETED',
    'COMPLETED_LATE',
    'BREACHED',
  ]),
  thresholdId: z.string().uuid().nullable(),
  thresholdName: z.string().nullable(),
  thresholdPercentage: z.number().nullable(),
  extensionAmountSec: z.number().int().nullable(),
  newDeadline: z.string().datetime().nullable(),
  triggeredById: z.string().uuid().nullable(),
  triggeredBy: UserRef.nullable(),
  eventData: z.unknown().nullable(),
  occurredAt: z.string().datetime(),
});

const SlaTimerResponse = z
  .object({
    id: z.string().uuid(),
    ticketId: z.string().uuid(),
    stageId: z.string().uuid(),
    policyId: z.string().uuid(),
    escalationTicketId: z.string().uuid().nullable(),
    status: SlaTimerStatusSchema,
    startedAt: z.string().datetime(),
    deadline: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    elapsedBeforePauseSec: z.number().int(),
    lastResumedAt: z.string().datetime().nullable(),
    totalExtensionsSec: z.number().int(),
    extensionCount: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    stage: StageRef,
    policy: z.object({
      id: z.string().uuid(),
      duration: z.number().int(),
      pauseOnHold: z.boolean(),
      calendar: z
        .object({ id: z.string().uuid(), name: z.string(), timezone: z.string() })
        .nullable(),
    }),
    escalationTicket: z
      .object({ id: z.string().uuid(), uniqueId: z.string(), title: z.string() })
      .nullable(),
  })
  .openapi('SlaTimer');

const SlaTimerWithEventsResponse = SlaTimerResponse.extend({
  events: z.array(SlaTimerEventResponse),
}).openapi('SlaTimerWithEvents');

const SlaExtensionResponse = z
  .object({
    id: z.string().uuid(),
    timerId: z.string().uuid(),
    requestedById: z.string().uuid(),
    requestedBy: UserRef.nullable(),
    approverId: z.string().uuid().nullable(),
    approver: UserRef.nullable(),
    status: ExtensionStatusSchema,
    reason: z.string(),
    extensionSec: z.number().int(),
    decidedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('SlaExtension');

const idParam = z.object({ id: z.string().uuid() });

// ─── Policy paths ──────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/workflows/{id}/sla-policies',
  tags: ['SLA'],
  summary: 'List SLA policies for a workflow',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    query: z.object({ includeDeleted: z.enum(['true', 'false']).optional() }),
  },
  responses: {
    200: { description: 'List', content: { 'application/json': { schema: z.array(SlaPolicyResponse) } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'post',
  path: '/sla-policies',
  tags: ['SLA'],
  summary: 'Create an SLA policy on a stage (1:1 with parentStage)',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateSlaPolicySchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: SlaPolicyResponse } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'get',
  path: '/sla-policies/{id}',
  tags: ['SLA'],
  summary: 'Get one SLA policy',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: 'Policy', content: { 'application/json': { schema: SlaPolicyResponse } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/sla-policies/{id}',
  tags: ['SLA'],
  summary: 'Update an SLA policy (any subset of fields)',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: UpdateSlaPolicySchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: SlaPolicyResponse } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/sla-policies/{id}',
  tags: ['SLA'],
  summary: 'Soft-delete an SLA policy (idempotent)',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

// ─── Threshold paths ───────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/sla-policies/{id}/thresholds',
  tags: ['SLA'],
  summary: 'Replace-all thresholds on a policy (idempotent, by name)',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: UpsertThresholdsSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: SlaPolicyResponse } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/sla-thresholds/{id}',
  tags: ['SLA'],
  summary: 'Delete a single SLA threshold',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

// ─── Timer + ticket read ───────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/sla/timers',
  tags: ['SLA'],
  summary: 'List SLA timers (dashboard query)',
  security: [{ bearerAuth: [] }],
  request: { query: ListTimersQuerySchema },
  responses: {
    200: {
      description: 'Paginated timers',
      content: {
        'application/json': {
          schema: z.object({
            items: z.array(SlaTimerResponse),
            total: z.number().int(),
            page: z.number().int(),
            pageSize: z.number().int(),
          }),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'get',
  path: '/tickets/{id}/sla',
  tags: ['SLA'],
  summary: "Ticket SLA summary (active timers with their full event history)",
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: {
      description: 'Timers',
      content: {
        'application/json': {
          schema: z.object({ timers: z.array(SlaTimerWithEventsResponse) }),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

// ─── Extension flow ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/sla/timers/{id}/extend',
  tags: ['SLA'],
  summary: 'Request a deadline extension on an active timer',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: RequestExtensionSchema } } },
  },
  responses: {
    201: { description: 'Created (status=PENDING)', content: { 'application/json': { schema: SlaExtensionResponse } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'post',
  path: '/sla/extensions/{id}/decide',
  tags: ['SLA'],
  summary: 'Approve or reject a pending extension request',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: DecideExtensionSchema } } },
  },
  responses: {
    200: {
      description: 'Decided. On APPROVED: timer deadline pushed, EXTENDED event emitted.',
      content: { 'application/json': { schema: SlaExtensionResponse } },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

// Silence the unused-import warning for PaginationMeta if not consumed in this file.
void PaginationMeta;
