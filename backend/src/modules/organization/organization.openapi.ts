import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import { UpdateOrganizationSchema, INDUSTRIES } from './organization.schema';

UpdateOrganizationSchema.openapi('UpdateOrganizationInput', {
  example: {
    name: 'Forge Quantum Solutions',
    industry: 'Pharmaceuticals',
    standards: ['ISO 9001', '21 CFR Part 11', 'GMP'],
  },
});

const OrganizationSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    tenantCode: z.string(),
    industry: z.enum(INDUSTRIES),
    website: z.string().nullable(),
    address: z.string().nullable(),
    standards: z.array(z.string()),
    timezone: z.string(),
    dateFormat: z.string(),
    logoUrl: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Organization');

registry.registerPath({
  method: 'get', path: '/organization', tags: ['Organization'],
  summary: 'Get the organization (singleton)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Organization', content: { 'application/json': { schema: OrganizationSchema } } },
    401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'put', path: '/organization', tags: ['Organization'],
  summary: 'Update the organization',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: UpdateOrganizationSchema } } } },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: OrganizationSchema } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'get', path: '/organization/industries', tags: ['Organization'],
  summary: 'List supported industries (used by the General settings dropdown)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Industry list',
      content: { 'application/json': { schema: z.array(z.enum(INDUSTRIES)) } },
    },
    401: errorResponses[401],
  },
});
