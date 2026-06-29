import type { Request, Response } from 'express';
import * as service from './unit.service';
import type { ListUnitQuery, UnitUpsertInput } from './unit.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listUnits(req.query as unknown as ListUnitQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getUnit(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createUnit(req.body as UnitUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateUnit(req.params.id as string, req.body as UnitUpsertInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteUnit(req.params.id as string, uid(req));
  res.status(204).send();
};
