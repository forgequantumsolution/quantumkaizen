import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  ListQuerySchema,
} from './department.schema';

CreateDepartmentSchema.openapi('CreateDepartmentInput', {
  example: {
    code: 'QC',
    name: 'Quality Control',
    description: 'QC laboratory',
    parentId: null,
    headUserId: null,
    costCenter: 'CC-1010',
    isActive: true,
  },
});
UpdateDepartmentSchema.openapi('UpdateDepartmentInput');

const UserRefSchema = z
  .object({ id: z.string().uuid(), name: z.string(), email: z.string().email() })
  .nullable();

const DepartmentParentRefSchema = z
  .object({ id: z.string().uuid(), code: z.string(), name: z.string() })
  .nullable();

const DepartmentSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    parentId: z.string().uuid().nullable(),
    headUserId: z.string().uuid().nullable(),
    costCenter: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    head: UserRefSchema,
    parent: DepartmentParentRefSchema,
    _count: z.object({ users: z.number().int(), children: z.number().int() }),
  })
  .openapi('Department');

const DepartmentListSchema = z.array(DepartmentSchema).openapi('DepartmentList');

// Tree response: each node is a Department plus a `children` array of the same
// shape (recursion). The OpenAPI generator can't introspect `z.lazy`, so we
// describe one level explicitly and note that children share the schema.
const DepartmentTreeNodeSchema = DepartmentSchema.extend({
  children: z
    .array(z.unknown())
    .describe('Recursive — each child has the same shape as Department plus its own `children`.'),
}).openapi('DepartmentTreeNode');

registry.registerPath({
  method: 'get',
  path: '/departments',
  tags: ['Departments'],
  summary: 'List departments (filterable)',
  security: [{ bearerAuth: [] }],
  request: { query: ListQuerySchema },
  responses: {
    200: { description: 'Department list', content: { 'application/json': { schema: DepartmentListSchema } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'get',
  path: '/departments/tree',
  tags: ['Departments'],
  summary: 'List departments as a hierarchical tree',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Tree of departments', content: { 'application/json': { schema: z.array(DepartmentTreeNodeSchema) } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'get',
  path: '/departments/{id}',
  tags: ['Departments'],
  summary: 'Get a department by ID',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Department', content: { 'application/json': { schema: DepartmentSchema } } },
    401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'post',
  path: '/departments',
  tags: ['Departments'],
  summary: 'Create a department',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateDepartmentSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: DepartmentSchema } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/departments/{id}',
  tags: ['Departments'],
  summary: 'Update a department',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateDepartmentSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: DepartmentSchema } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/departments/{id}',
  tags: ['Departments'],
  summary: 'Delete a department (blocked when users or sub-depts attached)',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409],
  },
});
