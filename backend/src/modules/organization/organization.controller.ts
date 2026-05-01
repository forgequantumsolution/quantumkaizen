import type { Request, Response } from 'express';
import * as service from './organization.service';

export const get = async (_req: Request, res: Response) => {
  res.json(await service.getCurrent());
};

export const put = async (req: Request, res: Response) => {
  res.json(await service.update(req.body));
};

export const industries = (_req: Request, res: Response) => {
  res.json(service.listIndustries());
};
