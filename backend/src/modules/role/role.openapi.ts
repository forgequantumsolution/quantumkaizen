import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  SetPermissionsSchema,
  ListQuerySchema,
} from './role.schema';

CreateRoleSchema.openapi('CreateRoleInput', {
  example: { name: 'LAB_TECHNICIAN', description: 'Lab technician', permissionIds: [] },
});
UpdateRoleSchema.openapi('UpdateRoleInput');
SetPermissionsSchema.openapi('SetPermissionsInput');

const PermissionSchema = z
  .object({
    id: z.string().uuid(),
    key: z.string(),
    module: z.string(),
    action: z.string(),
    description: z.string(),
  })
  .openapi('Permission');

const RoleSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    isSystem: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    permissions: z.array(PermissionSchema),
    _count: z.object({ users: z.number().int() }),
  })
  .openapi('Role');

registry.registerPath({
  method: 'get', path: '/roles', tags: ['Roles'],
  summary: 'List all roles with permissions',
  security: [{ bearerAuth: [] }],
  request: { query: ListQuerySchema },
  responses: {
    200: { description: 'Role list', content: { 'application/json': { schema: z.array(RoleSchema) } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'get', path: '/roles/{id}', tags: ['Roles'],
  summary: 'Get a role by ID',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Role', content: { 'application/json': { schema: RoleSchema } } },
    401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'post', path: '/roles', tags: ['Roles'],
  summary: 'Create a custom role',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateRoleSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: RoleSchema } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'patch', path: '/roles/{id}', tags: ['Roles'],
  summary: 'Update a role (description/permissions; name is immutable)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateRoleSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: RoleSchema } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'put', path: '/roles/{id}/permissions', tags: ['Roles'],
  summary: 'Set the full list of permissions for a role',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: SetPermissionsSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: RoleSchema } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete', path: '/roles/{id}', tags: ['Roles'],
  summary: 'Delete a custom role (system roles 403; assigned roles 409)',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409],
  },
});

export { RoleSchema, PermissionSchema };
