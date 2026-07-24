import type { Request, Response } from 'express';
import * as service from './audit-trail.service';
import { recordAudit } from '../../lib/audit';

export const list = async (req: Request, res: Response) => {
  res.json(await service.listTrail(req.query as service.TrailQuery));
};

export const history = async (req: Request, res: Response) => {
  res.json(
    await service.entityHistory(req.params.entityType as string, req.params.entityId as string),
  );
};

export const facets = async (_req: Request, res: Response) => {
  res.json(await service.trailFacets());
};

export const chain = async (_req: Request, res: Response) => {
  res.json(await service.chainStatus());
};

export const exportCsv = async (req: Request, res: Response) => {
  const q = req.query as service.TrailQuery;
  const csv = await service.exportCsv(q);

  // Taking a copy of the trail out of the system is itself a recorded event —
  // an auditor asks who extracted records, not just who changed them.
  await recordAudit({
    entityType: 'AuditTrail',
    entityId: 'export',
    action: 'EXPORT',
    module: 'ADMIN',
    criticality: 'CRITICAL',
    newValue: `CSV export (${JSON.stringify(q)})`,
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${stamp}.csv"`);
  res.send(csv);
};
