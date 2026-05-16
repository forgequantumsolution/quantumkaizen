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
      forms: z.array(z.unknown()).optional(),
      sla: z.array(z.unknown()).optional(),
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
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const DraftBodySchema = z.object({
  flow_json: z.unknown(),
});

export type SaveWorkflowBody = z.infer<typeof SaveWorkflowBodySchema>;
export type CreateWorkflowShellInput = z.infer<typeof CreateWorkflowShellSchema>;
export type ListWorkflowsQuery = z.infer<typeof ListWorkflowsQuerySchema>;
export type WorkflowNode = z.infer<typeof NodeSchema>;
export type WorkflowEdge = z.infer<typeof EdgeSchema>;
export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;
