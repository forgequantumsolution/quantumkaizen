import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().uuid() });

export const ListItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

export const CreateItemSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  document_id: z.string().optional().nullable(),
  role_id: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const UpdateItemSchema = CreateItemSchema.partial();

export const AssignSchema = z
  .object({
    user_ids: z.array(z.string()).optional(),
    role_id: z.string().optional(),
    due_date: z.string().optional().nullable(),
  })
  .refine((d) => (d.user_ids && d.user_ids.length) || d.role_id, {
    message: 'Provide user_ids or role_id',
  });

export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;
export type CreateItemInput = z.infer<typeof CreateItemSchema>;
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;
export type AssignInput = z.infer<typeof AssignSchema>;
