import type { Request, Response } from 'express';
import * as svc from './lims-analytics.service';
import type { AuditReviewQuery } from './lims-analytics.schema';

export const dashboard = async (_req: Request, res: Response) => res.json(await svc.dashboard());
export const tat = async (_req: Request, res: Response) => res.json(await svc.tat());
export const workload = async (_req: Request, res: Response) => res.json(await svc.workload());
export const auditReview = async (req: Request, res: Response) => res.json(await svc.auditReview(req.query as unknown as AuditReviewQuery));
export const auditEntityTypes = async (_req: Request, res: Response) => res.json(await svc.auditEntityTypes());
