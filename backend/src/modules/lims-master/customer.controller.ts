import type { Request, Response } from 'express';
import * as service from './customer.service';
import type { ListCustomerQuery, CustomerUpsertInput } from './customer.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listCustomers(req.query as unknown as ListCustomerQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getCustomer(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createCustomer(req.body as CustomerUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateCustomer(req.params.id as string, req.body as CustomerUpsertInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteCustomer(req.params.id as string, uid(req));
  res.status(204).send();
};
