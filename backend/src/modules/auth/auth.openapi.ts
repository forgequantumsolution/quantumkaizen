import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import { LoginSchema, RegisterSchema } from './auth.schema';

LoginSchema.openapi('LoginInput', {
  example: { email: 'info@forgequantumsolution.com', password: 'Admin@123' },
});
RegisterSchema.openapi('RegisterInput', {
  example: { email: 'new.user@forgequantum.com', password: 'StrongPass@123', name: 'New User' },
});

const RoleRefSchema = z
  .object({ id: z.string().uuid(), name: z.string() })
  .nullable()
  .openapi('RoleRef');

const DepartmentRefSchema = z
  .object({ id: z.string().uuid(), code: z.string(), name: z.string() })
  .nullable()
  .openapi('DepartmentRef');

const AuthUserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    employeeId: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    designation: z.string().nullable(),
    isActive: z.boolean(),
    departmentId: z.string().uuid().nullable(),
    roleId: z.string().uuid().nullable(),
    siteId: z.string().uuid().nullable(),
    department: DepartmentRefSchema,
    role: RoleRefSchema,
    permissions: z.array(z.string()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('AuthUser');

const AuthResponseSchema = z
  .object({
    user: AuthUserSchema,
    token: z.string().describe('JWT — paste into the Authorize dialog as `bearerAuth`.'),
  })
  .openapi('AuthResponse');

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Log in with email + password',
  request: {
    body: { content: { 'application/json': { schema: LoginSchema } } },
  },
  responses: {
    200: { description: 'Login successful', content: { 'application/json': { schema: AuthResponseSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user (admin endpoint — open in dev)',
  request: {
    body: { content: { 'application/json': { schema: RegisterSchema } } },
  },
  responses: {
    201: { description: 'User created', content: { 'application/json': { schema: AuthResponseSchema } } },
    400: errorResponses[400],
    409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Get the current authenticated user',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Current user', content: { 'application/json': { schema: z.object({ user: AuthUserSchema }) } } },
    401: errorResponses[401],
  },
});

export { AuthUserSchema, AuthResponseSchema };
