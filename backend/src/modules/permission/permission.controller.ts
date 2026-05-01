import type { Request, Response } from 'express';
import * as service from './permission.service';

export const list = async (req: Request, res: Response) => {
  if (req.query.grouped === 'true') {
    res.json(await service.grouped());
    return;
  }
  res.json(await service.list());
};
