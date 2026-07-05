import type { Request, Response } from 'express';
import * as service from './user.service';
import type { ListQuery } from './user.schema';

export const list = async (req: Request, res: Response) => {
  res.json(await service.list(req.query as unknown as ListQuery));
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

export const resetPassword = async (req: Request, res: Response) => {
  await service.resetPassword(req.params.id as string, req.body);
  res.status(204).send();
};

export const remove = async (req: Request, res: Response) => {
  res.json(await service.deactivate(req.params.id as string));
};

export const getPermissions = async (req: Request, res: Response) => {
  res.json(await service.getPermissions(req.params.id as string));
};

export const setPermissions = async (req: Request, res: Response) => {
  res.json(await service.setOverrides(req.params.id as string, req.body, req.user?.userId));
};
