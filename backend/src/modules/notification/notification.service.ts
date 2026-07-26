import type { Notification } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';

const toDto = (n: Notification) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  entityType: n.entityType,
  entityId: n.entityId,
  isRead: n.readAt !== null,
  createdAt: n.createdAt.toISOString(),
});

// Recent notifications for a user + the unread count (drives the bell badge).
export const list = async (userId: string) => {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items: rows.map(toDto), unreadCount };
};

export const markRead = async (userId: string, id: string) => {
  const n = await prisma.notification.findUnique({
    where: { id },
    select: { userId: true, readAt: true },
  });
  if (!n || n.userId !== userId) throw NotFound('Notification not found');
  if (!n.readAt) {
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
};

export const markAllRead = async (userId: string) => {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
};
