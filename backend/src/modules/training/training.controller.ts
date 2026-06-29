import type { Request, Response } from 'express';
import * as service from './training.service';
import type { AssignInput, CreateItemInput, ListItemsQuery, UpdateItemInput } from './training.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listItems(req.query as unknown as ListItemsQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getItem(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createItem(req.body as CreateItemInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateItem(req.params.id as string, req.body as UpdateItemInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteItem(req.params.id as string, uid(req));
  res.status(204).send();
};
export const assign = async (req: Request, res: Response) => {
  res.json(await service.assignTraining(req.params.id as string, req.body as AssignInput, uid(req)));
};
export const complete = async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  res.json(await service.completeTraining(req.params.id as string, userId));
};
export const myTraining = async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  res.json(await service.listMyTraining(userId));
};
