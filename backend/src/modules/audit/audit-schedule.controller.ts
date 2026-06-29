import type { Request, Response } from 'express';
import * as service from './audit-schedule.service';
import { success } from '../dynamic-form/dynamic-form.response';
import type {
  AuditScheduleRuleUpsertInput,
  CalendarQuery,
  ListScheduleRuleQuery,
} from './audit.schema';

export const listRules = async (req: Request, res: Response) => {
  res.json(await service.listScheduleRules(req.query as unknown as ListScheduleRuleQuery));
};
export const createRule = async (req: Request, res: Response) => {
  const data = await service.createScheduleRule(
    req.body as AuditScheduleRuleUpsertInput,
    req.user?.userId,
  );
  success(res, 'Schedule rule created', data, 201);
};
export const updateRule = async (req: Request, res: Response) => {
  const data = await service.updateScheduleRule(
    req.params.id as string,
    req.body as AuditScheduleRuleUpsertInput,
  );
  success(res, 'Schedule rule updated', data);
};
export const deleteRule = async (req: Request, res: Response) => {
  await service.deleteScheduleRule(req.params.id as string);
  success(res, 'Schedule rule deleted');
};
export const runNow = async (_req: Request, res: Response) => {
  const result = await service.spawnDueAudits();
  success(res, `Generated ${result.spawned_count} audit(s)`, result);
};
export const getCalendar = async (req: Request, res: Response) => {
  res.json(await service.getCalendar(req.query as unknown as CalendarQuery));
};
