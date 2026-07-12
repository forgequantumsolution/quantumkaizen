import type { Request, Response } from 'express';
import * as service from './workflow.service';
import { WorkflowValidationError } from './workflow.service';
import {
  getEffectivePermissionKeys,
  workflowTypeReadScope,
  resolveSiteScope,
  type TicketTypeScope,
} from '../../middleware/permissions';
import type {
  CreateWorkflowShellInput,
  ListWorkflowsQuery,
  SaveWorkflowBody,
  SetWorkflowStatusInput,
} from './workflow.schema';

const userId = (req: Request): string | null => req.user?.userId ?? null;

// Resolve which workflow types the caller may see. No user (shouldn't happen after
// requireAuth) → closed default (sees nothing scoped, matching ticket behaviour).
const scopeFor = async (req: Request): Promise<TicketTypeScope> => {
  const uid = userId(req);
  if (!uid) return { all: false, typeIds: [] };
  return workflowTypeReadScope(await getEffectivePermissionKeys(uid));
};

export const list = async (req: Request, res: Response) => {
  const uid = userId(req);
  const [scope, siteScope] = await Promise.all([
    scopeFor(req),
    uid ? resolveSiteScope(uid) : Promise.resolve({ all: false, siteIds: [] }),
  ]);
  res.json(await service.list(req.query as unknown as ListWorkflowsQuery, scope, uid, siteScope));
};

export const directory = async (req: Request, res: Response) => {
  const typeId = typeof req.query.typeId === 'string' ? req.query.typeId : undefined;
  const uid = userId(req);
  const [scope, siteScope] = await Promise.all([
    scopeFor(req),
    uid ? resolveSiteScope(uid) : Promise.resolve({ all: false, siteIds: [] }),
  ]);
  res.json(await service.directory(typeId, scope, siteScope));
};

export const get = async (req: Request, res: Response) => {
  res.json(await service.getById(req.params.id as string));
};

export const create = async (req: Request, res: Response) => {
  const body = req.body as CreateWorkflowShellInput;
  res.status(201).json(await service.createShell(body, userId(req)));
};

export const save = async (req: Request, res: Response) => {
  try {
    const result = await service.save(
      req.params.id as string,
      req.body as SaveWorkflowBody,
      userId(req)
    );
    res.json(result);
  } catch (err) {
    if (err instanceof WorkflowValidationError) {
      res.status(400).json({
        status: false,
        msg: 'Workflow validation failed',
        validation_errors: err.errors,
        error_count: err.errors.length,
        details: 'Please fix the validation errors listed above and try again.',
      });
      return;
    }
    throw err;
  }
};

export const remove = async (req: Request, res: Response) => {
  await service.softDelete(req.params.id as string, userId(req));
  res.status(204).send();
};

export const setStatus = async (req: Request, res: Response) => {
  const { workflowStatus } = req.body as SetWorkflowStatusInput;
  res.json(await service.setStatus(req.params.id as string, workflowStatus));
};

export const draftSave = async (req: Request, res: Response) => {
  res.json(
    await service.upsertDraft(
      req.params.id as string,
      (req.body as { flow_json: unknown }).flow_json
    )
  );
};

export const draftGet = async (req: Request, res: Response) => {
  res.json(await service.getDraft(req.params.id as string));
};

export const draftDelete = async (req: Request, res: Response) => {
  await service.deleteDraft(req.params.id as string);
  res.status(204).send();
};
