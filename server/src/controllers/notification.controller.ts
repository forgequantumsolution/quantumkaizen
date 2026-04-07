import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

export const listNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const pagination = parsePagination(req.query as Record<string, unknown>);

    const where: Record<string, unknown> = {
      tenantId: req.user.tenantId,
      userId: req.user.id,
    };

    if (req.query.isRead !== undefined) {
      where.isRead = req.query.isRead === 'true';
    }

    if (req.query.type) {
      where.type = req.query.type as string;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    res.status(200).json(buildPaginationResponse(notifications, total, pagination.page, pagination.limit));
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const count = await prisma.notification.count({
      where: {
        tenantId: req.user.tenantId,
        userId: req.user.id,
        isRead: false,
      },
    });

    res.status(200).json({ data: { unreadCount: count } });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const { id } = req.params;

    const result = await prisma.notification.updateMany({
      where: {
        id,
        userId: req.user.id,
        tenantId: req.user.tenantId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    res.status(200).json({ data: { message: 'Notification marked as read' } });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

    const result = await prisma.notification.updateMany({
      where: {
        tenantId: req.user.tenantId,
        userId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.status(200).json({ data: { message: 'All notifications marked as read', count: result.count } });
  } catch (error) {
    next(error);
  }
};
