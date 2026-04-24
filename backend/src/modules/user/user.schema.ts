import { z } from 'zod';

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  roleId: z.string().uuid().nullable().optional(),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
