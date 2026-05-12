/**
 * OpenAPI registrations for the Approval module.
 * Pulled in by `backend/src/openapi/spec.ts` at boot.
 */
import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import {
  ApprovalModeSchema,
  CreateApprovalPolicySchema,
  UpdateApprovalPolicySchema,
} from './approval.schema';

CreateApprovalPolicySchema.openapi('CreateApprovalPolicyInput', {
  example: {
    stageId: '00000000-0000-0000-0000-000000000001',
    actionId: '00000000-0000-0000-0000-000000000002',
    mode: 'ALL_REQUIRED',
    requiredCount: 2,
    strictRoleMatch: false,
    allowSelfApproval: false,
    requireUniqueApprovers: true,
    approvalSlaHours: 24,
    isActive: true,
    approverRoleIds: ['00000000-0000-0000-0000-000000000003'],
    approverUserIds: [],
  },
});

UpdateApprovalPolicySchema.openapi('UpdateApprovalPolicyInput', {
  example: { isActive: false },
});

// ─── Response shapes ───────────────────────────────────────────────────────

const RoleRef = z.object({ id: z.string().uuid(), name: z.string() });
const UserRef = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

const ApprovalPolicyResponse = z
  .object({
    id: z.string().uuid(),
    workflowId: z.string().uuid(),
    stageId: z.string().uuid(),
    actionId: z.string().uuid(),
    mode: ApprovalModeSchema,
    requiredCount: z.number().int(),
    strictRoleMatch: z.boolean(),
    allowSelfApproval: z.boolean(),
    requireUniqueApprovers: z.boolean(),
    approvalSequence: z.array(z.record(z.unknown())).nullable(),
    approvalSlaHours: z.number().int().nullable(),
    isActive: z.boolean(),
    isDeleted: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    approverRoles: z.array(RoleRef),
    approverUsers: z.array(UserRef),
    stage: z.object({
      id: z.string().uuid(),
      name: z.string(),
      canonicalId: z.string(),
    }),
    action: z.object({
      id: z.string().uuid(),
      isPrimary: z.boolean(),
      workflowAction: z.object({
        id: z.string().uuid(),
        name: z.string(),
        behavior: z.enum(['FORWARD', 'REJECT', 'HOLD', 'UNHOLD', 'RETURN', 'REASSIGN']),
      }),
    }),
  })
  .openapi('ApprovalPolicy');

const ApprovalRecordResponse = z
  .object({
    id: z.string().uuid(),
    decision: z.enum(['APPROVED', 'REJECTED']),
    comment: z.string().nullable(),
    decidedAt: z.string().datetime(),
    sequenceOrder: z.number().int(),
    approver: UserRef.nullable(),
    approvedAsRole: RoleRef.nullable(),
  })
  .openapi('ApprovalRecord');

const ApprovalInstanceResponse = z
  .object({
    id: z.string().uuid(),
    ticketId: z.string().uuid(),
    policyId: z.string().uuid(),
    triggeringActionId: z.string().uuid().nullable(),
    status: z.enum(['PENDING', 'SATISFIED', 'REJECTED', 'EXPIRED', 'INVALIDATED', 'CANCELLED']),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    deadlineAt: z.string().datetime().nullable(),
    currentSequenceOrder: z.number().int(),
    invalidatedAt: z.string().datetime().nullable(),
    invalidatedReason: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    policy: z.object({
      id: z.string().uuid(),
      mode: ApprovalModeSchema,
      requiredCount: z.number().int(),
      approverRoles: z.array(RoleRef),
      approverUsers: z.array(UserRef),
      stage: z.object({
        id: z.string().uuid(),
        name: z.string(),
        canonicalId: z.string(),
      }),
      action: z.object({
        id: z.string().uuid(),
        workflowAction: z.object({
          id: z.string().uuid(),
          name: z.string(),
          behavior: z.enum(['FORWARD', 'REJECT', 'HOLD', 'UNHOLD', 'RETURN', 'REASSIGN']),
        }),
      }),
    }),
    records: z.array(ApprovalRecordResponse),
  })
  .openapi('ApprovalInstance');

const idParam = z.object({ id: z.string().uuid() });
const instanceIdParam = z.object({ instanceId: z.string().uuid() });

// ─── Workflow-scoped policy routes ─────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/workflows/{id}/approval-policies',
  tags: ['Approvals'],
  summary: "List a workflow's approval policies",
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    query: z.object({
      includeInactive: z.enum(['true', 'false']).optional(),
      includeDeleted: z.enum(['true', 'false']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'List',
      content: { 'application/json': { schema: z.array(ApprovalPolicyResponse) } },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'post',
  path: '/workflows/{id}/approval-policies',
  tags: ['Approvals'],
  summary: 'Create an approval policy on a (stage, action) of a workflow',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: CreateApprovalPolicySchema } } },
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: ApprovalPolicyResponse } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

// ─── Policy-by-id routes ───────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/approval-policies/{id}',
  tags: ['Approvals'],
  summary: 'Get one approval policy',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: { description: 'Policy', content: { 'application/json': { schema: ApprovalPolicyResponse } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/approval-policies/{id}',
  tags: ['Approvals'],
  summary: 'Update an approval policy (any subset of fields)',
  security: [{ bearerAuth: [] }],
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: UpdateApprovalPolicySchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: ApprovalPolicyResponse } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/approval-policies/{id}',
  tags: ['Approvals'],
  summary: 'Soft-delete an approval policy (idempotent)',
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

// ─── Instance read routes ──────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/tickets/{id}/approvals',
  tags: ['Approvals'],
  summary: "List a ticket's approval instances + their records",
  security: [{ bearerAuth: [] }],
  request: { params: idParam },
  responses: {
    200: {
      description: 'List',
      content: { 'application/json': { schema: z.array(ApprovalInstanceResponse) } },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'get',
  path: '/approvals/{instanceId}',
  tags: ['Approvals'],
  summary: 'Get one approval instance with all records',
  security: [{ bearerAuth: [] }],
  request: { params: instanceIdParam },
  responses: {
    200: {
      description: 'Instance',
      content: { 'application/json': { schema: ApprovalInstanceResponse } },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

// NOTE: POST /approvals/{instanceId}/decide is intentionally NOT registered.
// It requires the engine intercept (engine/approval.layer.ts) which ships in P3.5.
