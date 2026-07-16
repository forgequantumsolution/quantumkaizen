import type { Request, Response } from 'express';
import * as service from './finding.service';
import { success } from '../dynamic-form/dynamic-form.response';
import type {
  FindingUpsertInput,
  FindingUpdateInput,
  ListFindingQuery,
  RaiseChildInput,
} from './finding.schema';

export const listFindings = async (req: Request, res: Response) => {
  res.json(await service.listFindings(req.query as unknown as ListFindingQuery));
};

export const listFindingsForTicket = async (req: Request, res: Response) => {
  res.json(await service.listFindingsForTicket(req.params.ticketId as string));
};

export const createFinding = async (req: Request, res: Response) => {
  const data = await service.createFinding(req.body as FindingUpsertInput, req.user?.userId);
  success(res, 'Finding created', data, 201);
};

export const updateFinding = async (req: Request, res: Response) => {
  const data = await service.updateFinding(req.params.id as string, req.body as FindingUpdateInput);
  success(res, 'Finding updated', data);
};

export const deleteFinding = async (req: Request, res: Response) => {
  await service.deleteFinding(req.params.id as string);
  success(res, 'Finding deleted', null);
};

export const raiseChild = async (req: Request, res: Response) => {
  const data = await service.raiseChild(
    req.params.id as string,
    req.body as RaiseChildInput,
    req.user!.userId,
  );
  success(res, 'Child ticket raised', data, 201);
};

export const listFindingChildren = async (req: Request, res: Response) => {
  res.json(await service.listFindingChildren(req.params.id as string));
};
