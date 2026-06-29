import type { Request, Response } from 'express';
import * as service from './certification.service';
import type { CertUpsertInput, ListCertQuery } from './certification.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listCertifications(req.query as unknown as ListCertQuery));
};
export const get = async (req: Request, res: Response) => {
  res.json(await service.getCertification(req.params.id as string));
};
export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createCertification(req.body as CertUpsertInput, uid(req)));
};
export const update = async (req: Request, res: Response) => {
  res.json(await service.updateCertification(req.params.id as string, req.body as CertUpsertInput, uid(req)));
};
export const remove = async (req: Request, res: Response) => {
  await service.deleteCertification(req.params.id as string, uid(req));
  res.status(204).send();
};
