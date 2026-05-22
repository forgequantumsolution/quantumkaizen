import { z } from 'zod';

const codeRegex = /^[A-Z0-9_-]{2,16}$/;

export const CreateSiteSchema = z.object({
  code: z.string().regex(codeRegex, 'Code must be 2–16 chars: A-Z, 0-9, _, -'),
  name: z.string().min(1).max(120),
  address: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const UpdateSiteSchema = CreateSiteSchema.partial();

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export type CreateSiteInput = z.infer<typeof CreateSiteSchema>;
export type UpdateSiteInput = z.infer<typeof UpdateSiteSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
