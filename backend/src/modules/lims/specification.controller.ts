import type { Request, Response } from 'express';
import * as service from './specification.service';
import type { ListSpecQuery, SpecUpsertInput } from './specification.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listSpecs(req.query as unknown as ListSpecQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getSpec(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createSpec(req.body as SpecUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateSpec(req.params.id as string, req.body as SpecUpsertInput, uid(req)));
};
export const approve = async (req: Request, res: Response) => {
  res.json(await service.approveSpec(req.params.id as string, uid(req)));
};
export const retire = async (req: Request, res: Response) => {
  res.json(await service.retireSpec(req.params.id as string, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteSpec(req.params.id as string, uid(req));
  res.status(204).send();
};
