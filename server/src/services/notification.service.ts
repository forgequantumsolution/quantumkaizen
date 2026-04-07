import prisma from '../lib/prisma.js';
import { NotificationType } from '@prisma/client';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType,
      entityId: params.entityId,
    },
  });
}

export async function markAsRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string, tenantId: string) {
  return prisma.notification.updateMany({
    where: { userId, tenantId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function getUserNotifications(
  userId: string,
  tenantId: string,
  query: Record<string, unknown>
) {
  const pagination = parsePagination(query);
  const where: Record<string, unknown> = { userId, tenantId };

  if (query.isRead !== undefined) {
    where.isRead = query.isRead === 'true';
  }

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return buildPaginationResponse(data, total, pagination.page, pagination.limit);
}

export async function getUnreadCount(userId: string, tenantId: string) {
  return prisma.notification.count({
    where: { userId, tenantId, isRead: false },
  });
}
