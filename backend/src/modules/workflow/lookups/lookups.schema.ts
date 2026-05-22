import { z } from 'zod';

export const StageActionBehaviorSchema = z.enum([
  'FORWARD',
  'REJECT',
  'HOLD',
  'UNHOLD',
  'RETURN',
  'REASSIGN',
]);

export const CreateWorkflowTypeSchema = z.object({
  name: z.string().min(1).max(250),
  codePrefix: z.string().min(1).max(20).optional(),
  iconName: z.string().min(1).max(100).optional(),
});

export const DeleteWorkflowTypeQuerySchema = z.object({
  hard: z.enum(['true', 'false']).optional().default('false'),
});

export const CreateStageStatusSchema = z.object({
  name: z.string().min(1).max(250),
  behavior: StageActionBehaviorSchema.default('FORWARD'),
});

export const CreateNamedSchema = z.object({
  name: z.string().min(1).max(250),
});

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const CreateSeveritySchema = z.object({
  name: z.string().min(1).max(80),
  level: z.coerce.number().int().min(0).max(1000).default(0),
  color: z
    .string()
    .regex(HEX_COLOR_RE, 'Color must be a hex value (e.g. #DC2626)')
    .optional()
    .nullable(),
});

export type CreateSeverityInput = z.infer<typeof CreateSeveritySchema>;

export const SearchQuerySchema = z.object({
  search: z.string().optional(),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export type CreateWorkflowTypeInput = z.infer<typeof CreateWorkflowTypeSchema>;
export type CreateStageStatusInput = z.infer<typeof CreateStageStatusSchema>;
export type CreateNamedInput = z.infer<typeof CreateNamedSchema>;
