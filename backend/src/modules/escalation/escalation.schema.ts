import { z } from 'zod';

export const EscalationTargetSchema = z.enum(['MANAGER', 'DEPARTMENT_HEAD']);

export const EscalationLevelSchema = z.object({
  order: z.number().int().min(1).max(50),
  target: EscalationTargetSchema,
  // Name of the SLA threshold that fires this level (matches SlaThreshold.name).
  // null → fire on breach rather than at a threshold percentage.
  atThresholdName: z.string().min(1).max(120).nullable().optional(),
});

export const UpsertEscalationRuleSchema = z
  .object({
    // null = the global default rule (used when a department has no rule).
    departmentId: z.string().uuid().nullable(),
    isActive: z.boolean().optional().default(true),
    levels: z.array(EscalationLevelSchema).max(20),
  })
  .superRefine((val, ctx) => {
    const orders = val.levels.map((l) => l.order);
    if (new Set(orders).size !== orders.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Level orders must be unique', path: ['levels'] });
    }
  });

export const IdParamSchema = z.object({ id: z.string().uuid() });

export type UpsertEscalationRuleInput = z.infer<typeof UpsertEscalationRuleSchema>;
