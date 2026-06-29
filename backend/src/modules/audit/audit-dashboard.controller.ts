import type { Request, Response } from 'express';
import * as service from './audit-dashboard.service';
import { getAuditReport } from './audit-report.service';

export const getDashboard = async (req: Request, res: Response) => {
  const fy = typeof req.query.financial_year === 'string' ? req.query.financial_year : undefined;
  res.json({ data: await service.getAuditDashboard(fy) });
};

export const getReport = async (req: Request, res: Response) => {
  res.json(await getAuditReport(req.params.id as string));
};
