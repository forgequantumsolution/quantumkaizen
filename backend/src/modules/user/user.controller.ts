import type { Request, Response } from 'express';
import * as service from './user.service';

export const list = async (req: Request, res: Response) => {
  res.json(await service.list(req.query as any));
};

export const get = async (req: Request, res: Response) => {
  res.json(await service.getById(req.params.id as string));
};

export const patch = async (req: Request, res: Response) => {
  res.json(await service.update(req.params.id as string, req.body));
};

export const remove = async (req: Request, res: Response) => {
  await service.remove(req.params.id as string);
  res.status(204).send();
};
