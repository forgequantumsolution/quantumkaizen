import type { Request, Response } from 'express';
import * as service from './sla.service';
import type {
  CreateSlaPolicyInput,
  DecideExtensionInput,
  ListTimersQuery,
  RequestExtensionInput,
  UpdateSlaPolicyInput,
  UpsertThresholdsInput,
} from './sla.schema';

// ─── Policies ──────────────────────────────────────────────────────────────

export const listPolicies = async (req: Request, res: Response) => {
  const workflowId = req.params.id as string;
  const includeDeleted = req.query.includeDeleted === 'true';
  res.json(await service.listPoliciesForWorkflow(workflowId, { includeDeleted }));
};

export const getPolicy = async (req: Request, res: Response) => {
  res.json(await service.getPolicy(req.params.id as string));
};

export const createPolicy = async (req: Request, res: Response) => {
  res.status(201).json(await service.createPolicy(req.body as CreateSlaPolicyInput));
};

export const updatePolicy = async (req: Request, res: Response) => {
  res.json(
    await service.updatePolicy(req.params.id as string, req.body as UpdateSlaPolicyInput),
  );
};

export const deletePolicy = async (req: Request, res: Response) => {
  await service.softDeletePolicy(req.params.id as string);
  res.status(204).send();
};

// ─── Thresholds ────────────────────────────────────────────────────────────

export const upsertThresholds = async (req: Request, res: Response) => {
  res.json(
    await service.upsertThresholds(req.params.id as string, req.body as UpsertThresholdsInput),
  );
};

export const deleteThreshold = async (req: Request, res: Response) => {
  await service.deleteThreshold(req.params.id as string);
  res.status(204).send();
};

// ─── Timer read ────────────────────────────────────────────────────────────

export const listTimers = async (req: Request, res: Response) => {
  res.json(await service.listTimers(req.query as unknown as ListTimersQuery));
};

export const getTicketSla = async (req: Request, res: Response) => {
  res.json(await service.getTicketSla(req.params.id as string));
};

// ─── Extensions ────────────────────────────────────────────────────────────

export const requestExtension = async (req: Request, res: Response) => {
  const timerId = req.params.id as string;
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });
  res
    .status(201)
    .json(await service.requestExtension(timerId, req.body as RequestExtensionInput, userId));
};

export const decideExtension = async (req: Request, res: Response) => {
  const extensionId = req.params.id as string;
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });
  res.json(
    await service.decideExtension(extensionId, req.body as DecideExtensionInput, userId),
  );
};
