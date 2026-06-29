import type { Request, Response } from 'express';
import * as service from './supplier.service';
import type { ListSupplierQuery, SupplierUpsertInput } from './supplier.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listSuppliers(req.query as unknown as ListSupplierQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getSupplier(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createSupplier(req.body as SupplierUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateSupplier(req.params.id as string, req.body as SupplierUpsertInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteSupplier(req.params.id as string, uid(req));
  res.status(204).send();
};
