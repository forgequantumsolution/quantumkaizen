/**
 * OpenAPI registrations for the BusinessCalendar module.
 */
import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import {
  CreateBusinessCalendarSchema,
  ListCalendarsQuerySchema,
  UpdateBusinessCalendarSchema,
} from './business-calendar.schema';

CreateBusinessCalendarSchema.openapi('CreateBusinessCalendarInput', {
  example: {
    name: 'India Office',
    timezone: 'Asia/Kolkata',
    weeklySchedule: {
      mon: { start: '09:00', end: '18:00' },
      tue: { start: '09:00', end: '18:00' },
      wed: { start: '09:00', end: '18:00' },
      thu: { start: '09:00', end: '18:00' },
      fri: { start: '09:00', end: '18:00' },
      sat: null,
      sun: null,
    },
    holidays: ['2026-01-26', '2026-08-15'],
    isActive: true,
  },
});

UpdateBusinessCalendarSchema.openapi('UpdateBusinessCalendarInput', {
  example: { holidays: ['2026-01-26', '2026-08-15', '2026-10-02'] },
});

const BusinessCalendarResponse = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    timezone: z.string(),
    weeklySchedule: z.unknown(),
    holidays: z.unknown(),
    isActive: z.boolean(),
    isDeleted: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    /** Present only when `?withPolicyCount=true` or on GET /:id (always). */
    policyCount: z.number().int().optional(),
  })
  .openapi('BusinessCalendar');

const idParam = z.object({ id: z.string().uuid() });

registry.registerPath({
  method: 'get',
  path: '/business-calendars',
  tags: ['Business Calendars'],
  summary: 'List business calendars',
  security: [{ bearerAuth: [] }],
  request: { query: ListCalendarsQuerySchema },
  responses: {
    200: {
      description: 'List',
      content: { 'application/json': { schema: z.array(BusinessCalendarResponse) } },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/business-calendars',
  tags: ['Business Calendars'],
  summary: 'Create a business calendar (revives soft-deleted on name match)',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateBusinessCalendarSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: BusinessCalendarResponse } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'get',
  path: '/business-calendars/{id}',
  tags: ['Business Calendars'],
  summary: 'Get one business calendar (always includes `policyCount`)',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: 'Calendar', content: { 'application/json': { schema: BusinessCalendarResponse } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/business-calendars/{id}',
  tags: ['Business Calendars'],
  summary: 'Update a business calendar',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: UpdateBusinessCalendarSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: BusinessCalendarResponse } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/business-calendars/{id}',
  tags: ['Business Calendars'],
  summary: 'Soft-delete a business calendar',
  description:
    'Returns `204` when no SLA policies referenced it; returns `200` with ' +
    '`{ affectedPolicies: N }` when one or more active policies still pointed at ' +
    'this calendar. Those policies keep their `calendarId` (FK uses SetNull only ' +
    'on hard-delete) so the admin can edit them deliberately.',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: {
      description: 'Soft-deleted, with affected-policy count',
      content: {
        'application/json': {
          schema: z.object({ affectedPolicies: z.number().int() }),
        },
      },
    },
    204: { description: 'Soft-deleted (no policies were referencing it)' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});
