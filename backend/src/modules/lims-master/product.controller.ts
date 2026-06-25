import type { Request, Response } from 'express';
import * as service from './product.service';
import type { ListProductQuery, ProductUpsertInput } from './product.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listProducts(req.query as unknown as ListProductQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getProduct(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createProduct(req.body as ProductUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateProduct(req.params.id as string, req.body as ProductUpsertInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteProduct(req.params.id as string, uid(req));
  res.status(204).send();
};
