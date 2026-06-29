import type { Request, Response } from 'express';
import * as service from './spec-version.service';
import type { ListSpecVersionQuery, SpecVersionUpsertInput } from './spec-version.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listSpecVersions(req.query as unknown as ListSpecVersionQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getSpecVersion(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createSpecVersion(req.body as SpecVersionUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateSpecVersion(req.params.id as string, req.body as SpecVersionUpsertInput, uid(req)));
};
export const approve = async (req: Request, res: Response) => {
  res.json(await service.approveSpecVersion(req.params.id as string, uid(req)));
};
export const revise = async (req: Request, res: Response) => {
  res.status(201).json(await service.reviseSpecVersion(req.params.id as string, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.removeSpecVersion(req.params.id as string, uid(req));
  res.status(204).send();
};
