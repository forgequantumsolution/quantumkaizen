import { z } from 'zod';

const employeeIdRegex = /^[A-Z0-9_-]{2,32}$/;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  employeeId: z
    .string()
    .regex(employeeIdRegex, 'Employee ID: 2–32 chars A-Z 0-9 _ -')
    .optional()
    .nullable(),
  firstName: z.string().min(1).max(60).optional().nullable(),
  lastName: z.string().min(1).max(60).optional().nullable(),
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).optional().nullable(),
  designation: z.string().max(120).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  roleId: z.string().uuid().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  joinDate: z.coerce.date().optional().nullable(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(60).optional(),
  isActive: z.boolean().optional(),
});

export const UpdateUserSchema = CreateUserSchema.omit({ password: true }).partial();

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Per-user permission overrides. The payload is the FULL desired override set —
// the service upserts these rows and deletes any (user, permission) override not
// present. `effect` GRANT adds a key; DENY removes it (deny wins over role/dept).
export const SetOverridesSchema = z.object({
  overrides: z.array(
    z.object({
      permissionId: z.string().uuid(),
      effect: z.enum(['GRANT', 'DENY']),
      reason: z.string().max(500).optional().nullable(),
    }),
  ),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type SetOverridesInput = z.infer<typeof SetOverridesSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
