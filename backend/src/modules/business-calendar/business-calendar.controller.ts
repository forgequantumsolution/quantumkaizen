import type { Request, Response } from 'express';
import * as service from './business-calendar.service';
import type {
  CreateBusinessCalendarInput,
  ListCalendarsQuery,
  UpdateBusinessCalendarInput,
} from './business-calendar.schema';

export const list = async (req: Request, res: Response) => {
  res.json(await service.list(req.query as unknown as ListCalendarsQuery));
};

export const getById = async (req: Request, res: Response) => {
  res.json(await service.getById(req.params.id as string));
};

export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.create(req.body as CreateBusinessCalendarInput));
};

export const update = async (req: Request, res: Response) => {
  res.json(
    await service.update(req.params.id as string, req.body as UpdateBusinessCalendarInput),
  );
};

export const softDelete = async (req: Request, res: Response) => {
  const result = await service.softDelete(req.params.id as string);
  // 200 + body when the soft-delete affected SLA policies (so the admin UI
  // can show "this calendar was referenced by N policies; they keep their
  // link but will fall back to wall-clock"); 204 when clean.
  if (result.affectedPolicies > 0) {
    res.status(200).json(result);
  } else {
    res.status(204).send();
  }
};
