import type { Request, Response } from 'express';
import * as svc from './nav-counts.service';

export const navCounts = async (_req: Request, res: Response) => res.json(await svc.navCounts());
