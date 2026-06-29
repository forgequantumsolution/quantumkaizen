import { z } from 'zod';

export const NodeTypeSchema = z.enum(['stage', 'fork', 'join', 'decision', 'audit_forms']);
export const SplitTypeSchema = z.enum(['AND', 'OR', 'XOR']);
export const JoinTypeSchema = z.enum(['AND', 'OR']);
export const WorkflowStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'DRAFT_UPDATE']);

const ActionPayloadSchema = z
  .object({
    stage_status_id: z.string().uuid(),
    type: z.enum(['primary', 'secondary']).optional(),
    action_criteria_id: z.string().uuid().optional().nullable(),
    roles_id: z.array(z.union([z.string(), z.object({}).passthrough()])).optional(),
    employees_id: z.array(z.union([z.string(), z.object({}).passthrough()])).optional(),
  })
  .passthrough();

// ─── Phase 3.5+ — embedded policy intents on each stage node ───────────────
// Persisted INSIDE node.data so the canvas JSON is the single source of truth
// during the build phase. The backend's buildWorkflowGraph materialises these
// into real ApprovalPolicy / SlaPolicy / StageFormBinding rows on Publish.

const EmbeddedFormBindingSchema = z.object({
  formId: z.string().uuid(),
  isRequired: z.boolean().default(true),
  position: z.number().int().min(0).max(1000).default(0),
  // Per-form access control. NOTE: fill*Ids are intentionally NOT .min(1) —
  // kept permissive so pre-feature workflows (empty fill group = legacy-open)
  // still validate on re-publish. The "≥1 fill role" rule is enforced in the
  // builder UI for new/edited bindings only. See the access-control plan §2/§4.
  fillMode: z.enum(['ANYONE', 'EACH']).default('ANYONE'),
  fillRoleIds: z.array(z.string().uuid()).max(200).default([]),
  fillUserIds: z.array(z.string().uuid()).max(200).default([]),
  viewRoleIds: z.array(z.string().uuid()).max(200).default([]),
  viewUserIds: z.array(z.string().uuid()).max(200).default([]),
});

const EmbeddedSlaThresholdSchema = z.object({
  name: z.string().min(1).max(80),
  percentage: z.number().int().min(1).max(100),
  targetStageCanonicalId: z.string().min(1).optional().nullable(),
});

const EmbeddedSlaSchema = z.object({
  duration: z.number().int().min(1).max(60 * 60 * 24 * 365),
  calendarId: z.string().uuid().optional().nullable(),
  escalationWorkflowId: z.string().uuid().optional().nullable(),
  pauseOnHold: z.boolean().default(true),
  pauseOnExtensionPending: z.boolean().default(false),
  thresholds: z.array(EmbeddedSlaThresholdSchema).max(50).default([]),
});

// Approval policies attach to a specific action on the stage. Actions don't
// have stable canonicalIds yet; we key by (actionType, actionIndex) which
// matches the order primary_actions/secondary_actions appear in node.data.
const EmbeddedApprovalPolicySchema = z.object({
  actionType: z.enum(['primary', 'secondary']),
  actionIndex: z.number().int().min(0).max(50),
  mode: z.enum(['SINGLE', 'ALL_REQUIRED', 'QUORUM', 'SEQUENTIAL', 'ANY']),
  requiredCount: z.number().int().min(1).max(100).default(1),
  strictRoleMatch: z.boolean().default(false),
  allowSelfApproval: z.boolean().default(false),
  requireUniqueApprovers: z.boolean().default(true),
  approverRoleIds: z.array(z.string().uuid()).max(200).default([]),
  approverUserIds: z.array(z.string().uuid()).max(200).default([]),
  approvalSlaHours: z.number().int().min(1).max(24 * 365).nullish(),
  isActive: z.boolean().default(true),
  approvalSequence: z
    .array(
      z.object({
        order: z.number().int().min(1),
        roleId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        label: z.string().min(1).max(200).optional(),
      }),
    )
    .max(50)
    .optional(),
});

const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().optional(),
  data: z
    .object({
      label: z.string().min(1),
      nodeType: NodeTypeSchema.optional(),
      basic_details: z
        .object({
          is_initial_stage: z.boolean().optional(),
          email_notification: z.boolean().optional(),
        })
        .passthrough()
        .optional()
        .default({}),
      primary_actions: z.array(ActionPayloadSchema).optional(),
      secondary_actions: z.array(ActionPayloadSchema).optional(),
      // Phase 3.5+ embedded policy intent — see schemas above.
      formBindings: z.array(EmbeddedFormBindingSchema).max(50).optional(),
      sla: EmbeddedSlaSchema.nullish(),
      approvalPolicies: z.array(EmbeddedApprovalPolicySchema).max(50).optional(),
      // Legacy fields — retained for backward-compat with older saved JSON.
      forms: z.array(z.unknown()).optional(),
      dependency: z.array(z.unknown()).optional(),
      child_workflow_triggers: z.array(z.unknown()).optional(),
      form_visibility_rules: z.array(z.unknown()).optional(),
      parallelConfig: z
        .object({
          branchCount: z.number().int().nonnegative().optional(),
          splitType: SplitTypeSchema.optional(),
          joinType: JoinTypeSchema.optional(),
          joinStageId: z.string().optional(),
        })
        .passthrough()
        .optional(),
      additional_data: z.record(z.unknown()).optional(),
    })
    .passthrough(),
});

const EdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional().nullable(),
  targetHandle: z.string().optional().nullable(),
  label: z.string().optional(),
  branchInfo: z
    .object({
      branchName: z.string().optional(),
      condition: z.string().optional(),
      order: z.number().int().optional(),
    })
    .optional(),
});

export const WorkflowSettingsSchema = z
  .object({
    maxExecutionsPerDay: z.number().int().nullable().optional(),
    timeoutSeconds: z.number().int().nullable().optional(),
    workflowStatus: WorkflowStatusSchema.optional(),
  })
  .strict();

export const SaveWorkflowBodySchema = z.object({
  flow_json: z.object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
  }),
  workflow_roles: z.array(z.string()).optional(),
  workflow_settings: WorkflowSettingsSchema.optional(),
});

export const CreateWorkflowShellSchema = z.object({
  name: z.string().min(1).max(200),
  typeId: z.string().uuid().optional().nullable(),
});

export const ListWorkflowsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  typeId: z.string().uuid().optional(),
  status: WorkflowStatusSchema.optional(),
  includeDeleted: z.enum(['true', 'false']).optional().default('false'),
  // When 'true', the list returns every Workflow row (all versions in every
  // lineage). Default 'false' filters to `isLatestVersion = true` so each
  // workflow only appears once.
  includeAllVersions: z.enum(['true', 'false']).optional().default('false'),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const SetWorkflowStatusSchema = z.object({
  workflowStatus: WorkflowStatusSchema,
});

export const DraftBodySchema = z.object({
  flow_json: z.unknown(),
});

export type SaveWorkflowBody = z.infer<typeof SaveWorkflowBodySchema>;
export type CreateWorkflowShellInput = z.infer<typeof CreateWorkflowShellSchema>;
export type ListWorkflowsQuery = z.infer<typeof ListWorkflowsQuerySchema>;
export type SetWorkflowStatusInput = z.infer<typeof SetWorkflowStatusSchema>;
export type WorkflowNode = z.infer<typeof NodeSchema>;
export type WorkflowEdge = z.infer<typeof EdgeSchema>;
export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;
export type EmbeddedFormBinding = z.infer<typeof EmbeddedFormBindingSchema>;
export type EmbeddedSla = z.infer<typeof EmbeddedSlaSchema>;
export type EmbeddedApprovalPolicy = z.infer<typeof EmbeddedApprovalPolicySchema>;
