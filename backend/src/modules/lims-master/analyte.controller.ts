import type { Request, Response } from 'express';
import * as service from './analyte.service';
import type { ListAnalyteQuery, AnalyteUpsertInput } from './analyte.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listAnalytes(req.query as unknown as ListAnalyteQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getAnalyte(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createAnalyte(req.body as AnalyteUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateAnalyte(req.params.id as string, req.body as AnalyteUpsertInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteAnalyte(req.params.id as string, uid(req));
  res.status(204).send();
};
