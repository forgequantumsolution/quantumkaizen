/**
 * Risk analytics controllers — read-only, thin by convention: no try/catch and
 * no logic, responses via the shared ok() envelope helper.
 */
import type { Request, Response } from 'express';
import { ok } from '../dynamic-form/dynamic-form.response';
import * as svc from './risk-analytics.service';
import type { ByCategoryQuery, OverdueQuery, TrendQuery } from './risk-analytics.schema';

export const getTrend = async (req: Request, res: Response) =>
  ok(res, await svc.getTrend(req.query as unknown as TrendQuery));

export const getOverdue = async (req: Request, res: Response) =>
  ok(res, await svc.getOverdue(req.query as unknown as OverdueQuery));

export const getByCategory = async (req: Request, res: Response) =>
  ok(res, await svc.getByCategory(req.query as unknown as ByCategoryQuery));
