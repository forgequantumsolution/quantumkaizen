import type { Request, Response } from 'express';
import * as service from './access.service';

export const whoCan = async (req: Request, res: Response) => {
  res.json(await service.whoCan(req.params.permissionKey as string));
};
