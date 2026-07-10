import type { Request, Response } from 'express';
import * as service from './audit-dashboard.service';
import { getAuditReport } from './audit-report.service';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

export const getDashboard = async (req: Request, res: Response) => {
  res.json({
    data: await service.getAuditDashboard({
      financialYear: str(req.query.financial_year),
      plant: str(req.query.plant),
      auditType: str(req.query.audit_type),
      status: str(req.query.status),
    }),
  });
};

export const getReport = async (req: Request, res: Response) => {
  res.json(await getAuditReport(req.params.id as string));
};
