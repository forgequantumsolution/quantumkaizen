import { z } from 'zod';

// Permission keys are single path segments like `sample.delete`,
// `business-calendar.read`, `workflow.lookups.manage`.
export const PermissionKeyParamSchema = z.object({
  permissionKey: z.string().regex(/^[a-z0-9_.-]+$/i, 'Invalid permission key'),
});

export type PermissionKeyParam = z.infer<typeof PermissionKeyParamSchema>;
