import { z } from 'zod';

const nameRegex = /^[A-Z0-9_]{2,40}$/;

export const CreateRoleSchema = z.object({
  name: z.string().regex(nameRegex, 'Name must be 2–40 chars: A-Z, 0-9, _'),
  description: z.string().max(500).optional().nullable(),
  permissionIds: z.array(z.string().uuid()).optional().default([]),
});

export const UpdateRoleSchema = z.object({
  description: z.string().max(500).optional().nullable(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export const SetPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type SetPermissionsInput = z.infer<typeof SetPermissionsSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
