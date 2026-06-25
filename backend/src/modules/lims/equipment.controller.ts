import type { Request, Response } from 'express';
import * as service from './equipment.service';
import type { EquipmentUpsertInput, ListEquipmentQuery, RecordCalibrationInput } from './equipment.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listEquipment(req.query as unknown as ListEquipmentQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getEquipment(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createEquipment(req.body as EquipmentUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateEquipment(req.params.id as string, req.body as EquipmentUpsertInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteEquipment(req.params.id as string, uid(req));
  res.status(204).send();
};
export const recordCalibration = async (req: Request, res: Response) => {
  res.json(await service.recordCalibration(req.params.id as string, req.body as RecordCalibrationInput, uid(req)));
};
