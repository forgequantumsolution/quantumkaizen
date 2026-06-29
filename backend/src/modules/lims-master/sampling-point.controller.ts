import type { Request, Response } from 'express';
import * as service from './sampling-point.service';
import type { ListSamplingPointQuery, SamplingPointUpsertInput } from './sampling-point.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listSamplingPoints(req.query as unknown as ListSamplingPointQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getSamplingPoint(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createSamplingPoint(req.body as SamplingPointUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateSamplingPoint(req.params.id as string, req.body as SamplingPointUpsertInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteSamplingPoint(req.params.id as string, uid(req));
  res.status(204).send();
};
