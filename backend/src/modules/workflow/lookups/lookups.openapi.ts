import { registry, z } from '../../../openapi/registry';
import { errorResponses } from '../../../openapi/common';
import {
  CreateNamedSchema,
  CreateStageStatusSchema,
  CreateWorkflowTypeSchema,
} from './lookups.schema';

CreateWorkflowTypeSchema.openapi('CreateWorkflowTypeInput', {
  example: { name: 'Document Review', codePrefix: 'DOC', iconName: 'file-text' },
});
CreateStageStatusSchema.openapi('CreateStageStatusInput', {
  example: { name: 'Approve', behavior: 'FORWARD' },
});
CreateNamedSchema.openapi('CreateNamedLookupInput', {
  example: { name: 'Anyone' },
});

const NamedRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const WorkflowTypeRow = NamedRow.extend({
  codePrefix: z.string().nullable(),
  iconConfig: z
    .object({
      id: z.string().uuid(),
      iconName: z.string(),
    })
    .nullable(),
}).openapi('WorkflowType');

const StageStatusRow = NamedRow.extend({
  behavior: z.enum(['FORWARD', 'REJECT', 'HOLD', 'UNHOLD', 'RETURN', 'REASSIGN']),
}).openapi('WorkflowStageStatus');

const idParam = z.object({ id: z.string().uuid() });

registry.registerPath({
  method: 'get',
  path: '/workflow-lookups/types',
  tags: ['Workflow Lookups'],
  summary: 'List workflow types',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'List', content: { 'application/json': { schema: z.array(WorkflowTypeRow) } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/workflow-lookups/types',
  tags: ['Workflow Lookups'],
  summary: 'Create a workflow type',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateWorkflowTypeSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: WorkflowTypeRow } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/workflow-lookups/types/{id}',
  tags: ['Workflow Lookups'],
  summary: 'Delete a workflow type (soft by default; ?hard=true for permanent)',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'get',
  path: '/workflow-lookups/stage-statuses',
  tags: ['Workflow Lookups'],
  summary: 'List stage statuses',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'List', content: { 'application/json': { schema: z.array(StageStatusRow) } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/workflow-lookups/stage-statuses',
  tags: ['Workflow Lookups'],
  summary: 'Create a stage status',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateStageStatusSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: StageStatusRow } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'get',
  path: '/workflow-lookups/action-types',
  tags: ['Workflow Lookups'],
  summary: 'List action types',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'List', content: { 'application/json': { schema: z.array(NamedRow) } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/workflow-lookups/action-types',
  tags: ['Workflow Lookups'],
  summary: 'Create an action type',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateNamedSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: NamedRow } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'get',
  path: '/workflow-lookups/action-criteria',
  tags: ['Workflow Lookups'],
  summary: 'List action criteria',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'List', content: { 'application/json': { schema: z.array(NamedRow) } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/workflow-lookups/action-criteria',
  tags: ['Workflow Lookups'],
  summary: 'Create an action criteria',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateNamedSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: NamedRow } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'get',
  path: '/workflow-lookups/priorities',
  tags: ['Workflow Lookups'],
  summary: 'List priorities',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'List', content: { 'application/json': { schema: z.array(NamedRow) } } },
    401: errorResponses[401], 403: errorResponses[403],
  },
});
