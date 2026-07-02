import type { Request, Response } from 'express';
import * as svc from './search.service';

export const search = async (req: Request, res: Response) =>
  res.json({ results: await svc.search(String(req.query.q ?? '')) });
