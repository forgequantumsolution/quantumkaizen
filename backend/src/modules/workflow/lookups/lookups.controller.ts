import type { Request, Response } from 'express';
import * as service from './lookups.service';

const search = (req: Request) => (req.query.search as string | undefined) ?? undefined;

// WorkflowType
export const listTypes = async (req: Request, res: Response) => {
  res.json(await service.listWorkflowTypes(search(req)));
};
export const createType = async (req: Request, res: Response) => {
  res.status(201).json(await service.createWorkflowType(req.body));
};
export const deleteType = async (req: Request, res: Response) => {
  const hard = (req.query.hard as string | undefined) === 'true';
  await service.deleteWorkflowType(req.params.id as string, hard);
  res.status(204).send();
};

// StageStatus
export const listStageStatuses = async (req: Request, res: Response) => {
  res.json(await service.listStageStatuses(search(req)));
};
export const createStageStatus = async (req: Request, res: Response) => {
  res.status(201).json(await service.createStageStatus(req.body));
};

// ActionType
export const listActionTypes = async (req: Request, res: Response) => {
  res.json(await service.listActionTypes(search(req)));
};
export const createActionType = async (req: Request, res: Response) => {
  res.status(201).json(await service.createActionType(req.body));
};

// ActionCriteria
export const listActionCriteria = async (req: Request, res: Response) => {
  res.json(await service.listActionCriteria(search(req)));
};
export const createActionCriteria = async (req: Request, res: Response) => {
  res.status(201).json(await service.createActionCriteria(req.body));
};

// Priority
export const listPriorities = async (_req: Request, res: Response) => {
  res.json(await service.listPriorities());
};

// Severity
export const listSeverities = async (req: Request, res: Response) => {
  res.json(await service.listSeverities(search(req)));
};
export const createSeverity = async (req: Request, res: Response) => {
  res.status(201).json(await service.createSeverity(req.body));
};
export const deleteSeverity = async (req: Request, res: Response) => {
  await service.deleteSeverity(req.params.id as string);
  res.status(204).send();
};
