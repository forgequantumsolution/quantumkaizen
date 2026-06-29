import type { Request, Response } from 'express';
import * as service from './test-definition.service';
import type {
  ListTestDefinitionQuery,
  TestDefinitionUpsertInput,
  ListTestPanelQuery,
  TestPanelUpsertInput,
} from './test-definition.schema';

const uid = (req: Request) => req.user?.userId;

// ── Test Definitions ──

export const listDefs = async (req: Request, res: Response) => {
  res.json(await service.listTestDefinitions(req.query as unknown as ListTestDefinitionQuery));
};
export const getDef = async (req: Request, res: Response) => {
  res.json(await service.getTestDefinition(req.params.id as string));
};
export const createDef = async (req: Request, res: Response) => {
  res.status(201).json(await service.createTestDefinition(req.body as TestDefinitionUpsertInput, uid(req)));
};
export const updateDef = async (req: Request, res: Response) => {
  res.json(await service.updateTestDefinition(req.params.id as string, req.body as TestDefinitionUpsertInput, uid(req)));
};
export const approveDef = async (req: Request, res: Response) => {
  res.json(await service.approveTestDefinition(req.params.id as string, uid(req)));
};
export const removeDef = async (req: Request, res: Response) => {
  await service.deleteTestDefinition(req.params.id as string, uid(req));
  res.status(204).send();
};

// ── Test Panels ──

export const listPanels = async (req: Request, res: Response) => {
  res.json(await service.listTestPanels(req.query as unknown as ListTestPanelQuery));
};
export const getPanel = async (req: Request, res: Response) => {
  res.json(await service.getTestPanel(req.params.id as string));
};
export const createPanel = async (req: Request, res: Response) => {
  res.status(201).json(await service.createTestPanel(req.body as TestPanelUpsertInput, uid(req)));
};
export const updatePanel = async (req: Request, res: Response) => {
  res.json(await service.updateTestPanel(req.params.id as string, req.body as TestPanelUpsertInput, uid(req)));
};
export const removePanel = async (req: Request, res: Response) => {
  await service.deleteTestPanel(req.params.id as string, uid(req));
  res.status(204).send();
};
