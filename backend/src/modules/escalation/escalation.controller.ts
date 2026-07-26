import type { Request, Response } from 'express';
import * as service from './escalation.service';
import type { UpsertEscalationRuleInput } from './escalation.schema';

export const list = async (_req: Request, res: Response) => {
  res.json(await service.list());
};

export const thresholdNames = async (_req: Request, res: Response) => {
  res.json(await service.listThresholdNames());
};

export const upsert = async (req: Request, res: Response) => {
  res.json(await service.upsert(req.body as UpsertEscalationRuleInput));
};

export const remove = async (req: Request, res: Response) => {
  await service.remove(req.params.id as string);
  res.status(204).send();
};
