import { z } from 'zod';

export const CreateDepartmentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
