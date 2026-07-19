import type { Request, Response } from 'express';
import * as svc from './dashboard.service';
import type { OverviewQuery } from './dashboard.schema';

export const overview = async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  res.json(await svc.overview(userId, req.query as unknown as OverviewQuery));
};
