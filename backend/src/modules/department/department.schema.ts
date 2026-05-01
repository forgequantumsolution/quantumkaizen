import { z } from 'zod';

const codeRegex = /^[A-Z0-9_-]{2,16}$/;

export const CreateDepartmentSchema = z.object({
  code: z.string().regex(codeRegex, 'Code must be 2–16 chars: A-Z, 0-9, _, -'),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  headUserId: z.string().uuid().optional().nullable(),
  costCenter: z.string().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  parentId: z.string().uuid().optional(),
});

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
