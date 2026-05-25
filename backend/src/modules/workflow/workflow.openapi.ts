import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import {
  CreateWorkflowShellSchema,
  DraftBodySchema,
  ListWorkflowsQuerySchema,
  SaveWorkflowBodySchema,
} from './workflow.schema';

CreateWorkflowShellSchema.openapi('CreateWorkflowShellInput', {
  example: { name: 'CAPA Approval', typeId: undefined },
});
SaveWorkflowBodySchema.openapi('SaveWorkflowInput');
DraftBodySchema.openapi('SaveWorkflowDraftInput');

const TagRef = z.object({ id: z.string().uuid(), name: z.string() }).nullable();
const UserRef = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  })
  .nullable();

const WorkflowSummarySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    workflowStatus: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'DRAFT_UPDATE']),
    version: z.number().int(),
    type: TagRef,
    stageCount: z.number().int(),
    transitionCount: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    createdBy: UserRef,
  })
  .openapi('WorkflowSummary');

const WorkflowListResponseSchema = z
  .object({
    items: z.array(WorkflowSummarySchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  })
  .openapi('WorkflowListResponse');

const WorkflowDetailResponseSchema = z
  .object({
    workflow: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        status: z.string(),
        workflowStatus: z.string(),
        type: TagRef,
        createdBy: UserRef,
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        isDeleted: z.boolean(),
        settings: z.object({
          maxExecutionsPerDay: z.number().int().nullable(),
          timeoutSeconds: z.number().int().nullable(),
        }),
      })
      .passthrough(),
    flow_json: z
      .object({
        nodes: z.array(z.unknown()),
        edges: z.array(z.unknown()),
      }),
    meta: z.object({ warnings: z.array(z.string()) }),
  })
  .openapi('WorkflowDetailResponse');

const WorkflowSaveResponseSchema = z
  .object({
    status: z.literal(true),
    msg: z.string(),
    workflow: z.object({
      id: z.string().uuid(),
    }),
    meta: z.object({ warnings: z.array(z.string()) }),
  })
  .openapi('WorkflowSaveResponse');

const ValidationFailureResponseSchema = z
  .object({
    status: z.literal(false),
    msg: z.string(),
    validation_errors: z.array(z.string()),
    error_count: z.number().int(),
    details: z.string(),
  })
  .openapi('WorkflowValidationFailure');

const idParam = z.object({ id: z.string().uuid() });

registry.registerPath({
  method: 'get',
  path: '/workflows',
  tags: ['Workflows'],
  summary: 'List workflows',
  security: [{ bearerAuth: [] }],
  request: { query: ListWorkflowsQuerySchema },
  responses: {
    200: { description: 'Workflow list', content: { 'application/json': { schema: WorkflowListResponseSchema } } },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/workflows',
  tags: ['Workflows'],
  summary: 'Create an empty workflow shell',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateWorkflowShellSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: z.object({ workflow: z.unknown() }) } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'get',
  path: '/workflows/{id}',
  tags: ['Workflows'],
  summary: 'Get a workflow with its full graph',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: 'Workflow', content: { 'application/json': { schema: WorkflowDetailResponseSchema } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'put',
  path: '/workflows/{id}',
  tags: ['Workflows'],
  summary: 'Save workflow graph (overwrites existing graph in place)',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: SaveWorkflowBodySchema } } },
  },
  responses: {
    200: { description: 'Saved', content: { 'application/json': { schema: WorkflowSaveResponseSchema } } },
    400: { description: 'Validation failure', content: { 'application/json': { schema: ValidationFailureResponseSchema } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/workflows/{id}',
  tags: ['Workflows'],
  summary: 'Soft-delete a workflow',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'post',
  path: '/workflows/{id}/draft',
  tags: ['Workflows'],
  summary: 'Save TemporaryWorkflow autosave snapshot',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: DraftBodySchema } } },
  },
  responses: {
    200: { description: 'Draft saved' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'get',
  path: '/workflows/{id}/draft',
  tags: ['Workflows'],
  summary: 'Get TemporaryWorkflow autosave snapshot',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: 'Draft (or null)' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});
