import type { Request, Response } from 'express';
import * as service from './notification.service';

const userId = (req: Request): string => {
  const id = req.user?.userId;
  if (!id) throw new Error('Missing user on request after requireAuth');
  return id;
};

export const list = async (req: Request, res: Response) => {
  res.json(await service.list(userId(req)));
};

export const markRead = async (req: Request, res: Response) => {
  await service.markRead(userId(req), req.params.id as string);
  res.status(204).send();
};

export const markAllRead = async (req: Request, res: Response) => {
  await service.markAllRead(userId(req));
  res.status(204).send();
};
