import type { Request, Response } from 'express';
import * as service from './compliance.service';
import { success } from '../dynamic-form/dynamic-form.response';
import type { SignInput } from './compliance.service';

export const getTrail = async (req: Request, res: Response) => {
  res.json(await service.getTrail(req.params.entityType as string, req.params.entityId as string));
};

export const getSignatures = async (req: Request, res: Response) => {
  res.json(
    await service.getSignatures(req.params.entityType as string, req.params.entityId as string),
  );
};

export const sign = async (req: Request, res: Response) => {
  const data = await service.recordSignature(req.body as SignInput, req.user?.userId);
  success(res, 'Signature recorded', data, 201);
};
