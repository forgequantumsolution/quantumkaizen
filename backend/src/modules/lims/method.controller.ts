import type { Request, Response } from 'express';
import * as service from './method.service';
import type { ListMethodQuery, MethodUpsertInput } from './method.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listMethods(req.query as unknown as ListMethodQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getMethod(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createMethod(req.body as MethodUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateMethod(req.params.id as string, req.body as MethodUpsertInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteMethod(req.params.id as string, uid(req));
  res.status(204).send();
};
