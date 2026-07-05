import type { Request, Response } from 'express';
import * as service from './department.service';
import type { ListQuery } from './department.schema';

export const list = async (req: Request, res: Response) => {
  res.json(await service.list(req.query as unknown as ListQuery));
};

export const tree = async (_req: Request, res: Response) => {
  res.json(await service.tree());
};

export const get = async (req: Request, res: Response) => {
  res.json(await service.getById(req.params.id as string));
};

export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.create(req.body));
};

export const patch = async (req: Request, res: Response) => {
  res.json(await service.update(req.params.id as string, req.body));
};

export const setPermissions = async (req: Request, res: Response) => {
  res.json(await service.setPermissions(req.params.id as string, req.body, req.user?.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.remove(req.params.id as string);
  res.status(204).send();
};
