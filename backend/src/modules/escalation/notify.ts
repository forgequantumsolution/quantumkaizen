/**
 * Notification seam. Everything that needs to tell a user something (assignment,
 * escalation, …) calls `notify()` — today it persists a Notification row that
 * the frontend NotificationPanel reads (wired in a later step). Email is a
 * second channel that will plug in here without changing call sites.
 */
import type { NotificationType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

type Db = Pick<typeof prisma, 'notification'>;

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

export const notify = async (input: NotifyInput, db: Db = prisma): Promise<void> => {
  await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });
};
