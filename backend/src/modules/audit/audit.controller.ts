import type { Request, Response } from 'express';
import * as service from './audit.service';
import { ok, success } from '../dynamic-form/dynamic-form.response';
import type {
  AuditScheduleUpsertInput,
  IsoUpsertInput,
  ListAuditQuery,
  ListIsoQuery,
  UpdateAuditDateInput,
} from './audit.schema';

// ── ISO standards ──
export const listIso = async (req: Request, res: Response) => {
  const data = await service.listIsoStandards(req.query as unknown as ListIsoQuery);
  res.json(data);
};

export const createIso = async (req: Request, res: Response) => {
  await service.createIsoStandard(req.body as IsoUpsertInput);
  success(res, 'ISO standard created', undefined, 201);
};

export const updateIso = async (req: Request, res: Response) => {
  await service.updateIsoStandard(req.params.id as string, req.body as IsoUpsertInput);
  success(res, 'ISO standard updated');
};

export const deleteIso = async (req: Request, res: Response) => {
  await service.deleteIsoStandard(req.params.id as string);
  success(res, 'ISO standard deleted');
};

// ── Audit schedules ──
export const listSchedules = async (req: Request, res: Response) => {
  const data = await service.listAuditSchedules(req.query as unknown as ListAuditQuery);
  res.json(data);
};

export const createSchedule = async (req: Request, res: Response) => {
  const data = await service.createAuditSchedule(
    req.body as AuditScheduleUpsertInput,
    req.user?.userId
  );
  success(res, 'Audit schedule created', data, 201);
};

export const updateSchedule = async (req: Request, res: Response) => {
  await service.updateAuditSchedule(
    req.params.id as string,
    req.body as AuditScheduleUpsertInput
  );
  success(res, 'Audit schedule updated');
};

export const updateScheduleDate = async (req: Request, res: Response) => {
  await service.updateAuditDate(
    req.params.scheduleId as string,
    req.body as UpdateAuditDateInput
  );
  success(res, 'Audit date updated');
};

export const deleteSchedule = async (req: Request, res: Response) => {
  await service.deleteAuditSchedule(req.params.id as string);
  success(res, 'Audit schedule deleted');
};

export const filters = async (_req: Request, res: Response) => {
  const data = await service.auditScheduleFilters();
  res.json(data);
};
