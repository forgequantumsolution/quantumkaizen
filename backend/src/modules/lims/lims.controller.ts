import type { Request, Response } from 'express';
import * as service from './lims.service';
import type { LabUpsertInput, ListLabsQuery } from './lims.schema';

const uid = (req: Request) => req.user?.userId;

export const listLabs = async (req: Request, res: Response) => {
  res.json(await service.listLabs(req.query as unknown as ListLabsQuery));
};
export const getLab = async (req: Request, res: Response) => {
  res.json(await service.getLab(req.params.id as string));
};
export const createLab = async (req: Request, res: Response) => {
  res.status(201).json(await service.createLab(req.body as LabUpsertInput, uid(req)));
};
export const updateLab = async (req: Request, res: Response) => {
  res.json(await service.updateLab(req.params.id as string, req.body as LabUpsertInput, uid(req)));
};
export const deleteLab = async (req: Request, res: Response) => {
  await service.deleteLab(req.params.id as string, uid(req));
  res.status(204).send();
};
