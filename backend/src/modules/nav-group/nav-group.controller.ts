import type { Request, Response } from 'express';
import * as service from './nav-group.service';

export const list = async (_req: Request, res: Response) => {
  res.json(await service.listNavGroups());
};

export const save = async (req: Request, res: Response) => {
  res.json(await service.saveNavGroups(req.body));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteNavGroup(req.params.id as string);
  res.status(204).send();
};
