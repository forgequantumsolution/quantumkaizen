import type { Request, Response } from 'express';
import * as service from './permission.service';
import type { ListQuery } from './permission.schema';

export const list = async (req: Request, res: Response) => {
  const query = req.query as unknown as ListQuery;
  if (query.grouped === 'true') {
    res.json(await service.grouped());
    return;
  }
  res.json(await service.list(query));
};
