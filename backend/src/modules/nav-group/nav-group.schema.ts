import { z } from 'zod';

/**
 * Full-document save payload. The client always sends the COMPLETE layout —
 * every group and every assigned module — never a diff. The service diffs it
 * against the stored rows so the audit trail records what actually changed
 * (see nav-group.service.ts).
 */
export const SaveNavGroupsSchema = z.object({
  /**
   * The newest `updatedAt` the client saw when it loaded the config. The server
   * rejects the save with 409 if anything has changed since — a full-document
   * PUT is otherwise last-write-wins and two admins editing at once would
   * silently clobber each other. Omit only for a first write.
   */
  baseUpdatedAt: z.string().datetime().nullable().optional(),
  groups: z
    .array(
      z.object({
        key: z
          .string()
          .min(1)
          .max(60)
          .regex(/^[a-z0-9-]+$/, 'Group key must be lowercase letters, digits and dashes'),
        // "" is legal — the ungrouped Dashboard row renders with no header.
        title: z.string().max(120),
        icon: z.string().max(100).nullable().optional(),
        collapsible: z.boolean().default(true),
        defaultOpen: z.boolean().default(false),
        isFallback: z.boolean().default(false),
        moduleKeys: z.array(z.string().min(1).max(200)),
      }),
    )
    .min(1, 'At least one group is required'),
});

export type SaveNavGroupsInput = z.infer<typeof SaveNavGroupsSchema>;
