import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export const UpdateRoleSchema = CreateRoleSchema.partial();

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
