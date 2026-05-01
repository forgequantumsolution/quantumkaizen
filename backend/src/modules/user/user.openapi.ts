import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
  ListQuerySchema,
} from './user.schema';

CreateUserSchema.openapi('CreateUserInput', {
  example: {
    email: 'priya.sharma@forgequantum.com',
    password: 'StrongPass@123',
    employeeId: 'EMP-201',
    firstName: 'Priya',
    lastName: 'Sharma',
    designation: 'QA Engineer',
    isActive: true,
  },
});
UpdateUserSchema.openapi('UpdateUserInput');
ResetPasswordSchema.openapi('ResetPasswordInput', {
  example: { password: 'NewSecure@456' },
});

const UserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    employeeId: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    phone: z.string().nullable(),
    designation: z.string().nullable(),
    isActive: z.boolean(),
    joinDate: z.string().datetime().nullable(),
    lastLoginAt: z.string().datetime().nullable(),
    avatarUrl: z.string().nullable(),
    locale: z.string(),
    timezone: z.string(),
    departmentId: z.string().uuid().nullable(),
    roleId: z.string().uuid().nullable(),
    siteId: z.string().uuid().nullable(),
    managerId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    department: z.object({ id: z.string().uuid(), code: z.string(), name: z.string() }).nullable(),
    role: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
    site: z.object({ id: z.string().uuid(), code: z.string(), name: z.string() }).nullable(),
    manager: z.object({ id: z.string().uuid(), name: z.string(), email: z.string().email() }).nullable(),
  })
  .openapi('User');

const UserListResponseSchema = z
  .object({
    items: z.array(UserSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  })
  .openapi('UserListResponse');

registry.registerPath({
  method: 'get', path: '/users', tags: ['Users'],
  summary: 'List users (paginated, filterable)',
  security: [{ bearerAuth: [] }],
  request: { query: ListQuerySchema },
  responses: {
    200: { description: 'User list', content: { 'application/json': { schema: UserListResponseSchema } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'get', path: '/users/{id}', tags: ['Users'],
  summary: 'Get a user by ID',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'User', content: { 'application/json': { schema: UserSchema } } },
    401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'post', path: '/users', tags: ['Users'],
  summary: 'Create a user',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateUserSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: UserSchema } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'patch', path: '/users/{id}', tags: ['Users'],
  summary: 'Update a user',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateUserSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: UserSchema } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'post', path: '/users/{id}/reset-password', tags: ['Users'],
  summary: "Reset a user's password (admin)",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: ResetPasswordSchema } } },
  },
  responses: {
    204: { description: 'Password updated' },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete', path: '/users/{id}', tags: ['Users'],
  summary: 'Soft-delete a user (sets isActive=false)',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'User deactivated', content: { 'application/json': { schema: UserSchema } } },
    401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});
