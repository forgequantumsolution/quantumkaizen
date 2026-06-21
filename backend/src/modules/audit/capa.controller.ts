import type { Request, Response } from 'express';
import * as service from './capa.service';
import { success } from '../dynamic-form/dynamic-form.response';
import type {
  ActionItemUpsertInput,
  CapaCreateInput,
  CapaUpdateInput,
  ListActionItemQuery,
  ListCapaQuery,
  UpdateActionItemStatusInput,
  UpdateCapaStatusInput,
} from './audit.schema';

// ── CAPA ──
export const listCapas = async (req: Request, res: Response) => {
  res.json(await service.listCapas(req.query as unknown as ListCapaQuery));
};
export const getCapa = async (req: Request, res: Response) => {
  res.json(await service.getCapa(req.params.id as string));
};
export const createCapa = async (req: Request, res: Response) => {
  const data = await service.createCapa(req.body as CapaCreateInput, req.user?.userId);
  success(res, 'CAPA created', data, 201);
};
export const updateCapa = async (req: Request, res: Response) => {
  const data = await service.updateCapa(req.params.id as string, req.body as CapaUpdateInput);
  success(res, 'CAPA updated', data);
};
export const updateCapaStatus = async (req: Request, res: Response) => {
  const data = await service.updateCapaStatus(
    req.params.id as string,
    req.body as UpdateCapaStatusInput,
    req.user?.userId,
  );
  success(res, 'CAPA status updated', data);
};
export const deleteCapa = async (req: Request, res: Response) => {
  await service.deleteCapa(req.params.id as string);
  success(res, 'CAPA deleted');
};

// ── Action Items ──
export const listActionItems = async (req: Request, res: Response) => {
  res.json(await service.listActionItems(req.query as unknown as ListActionItemQuery));
};
export const createActionItem = async (req: Request, res: Response) => {
  const data = await service.createActionItem(req.body as ActionItemUpsertInput, req.user?.userId);
  success(res, 'Action item created', data, 201);
};
export const updateActionItem = async (req: Request, res: Response) => {
  const data = await service.updateActionItem(
    req.params.id as string,
    req.body as ActionItemUpsertInput,
  );
  success(res, 'Action item updated', data);
};
export const updateActionItemStatus = async (req: Request, res: Response) => {
  const data = await service.updateActionItemStatus(
    req.params.id as string,
    req.body as UpdateActionItemStatusInput,
  );
  success(res, 'Action item status updated', data);
};
export const deleteActionItem = async (req: Request, res: Response) => {
  await service.deleteActionItem(req.params.id as string);
  success(res, 'Action item deleted');
};
