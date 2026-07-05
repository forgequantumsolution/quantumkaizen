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

export const SetPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  parentId: z.string().uuid().optional(),
});

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;
export type SetPermissionsInput = z.infer<typeof SetPermissionsSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
