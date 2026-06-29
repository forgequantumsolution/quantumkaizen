/**
 * StageFormBinding controller (Phase 3.5).
 *
 * Thin request→service shim; all business logic lives in stage-form.service.ts.
 */
import type { Request, Response } from 'express';
import * as service from './stage-form.service';
import type {
  CreateStageFormBindingInput,
  CreateWorkflowSubmissionInput,
  ListBindingsQuery,
  UpdateStageFormBindingInput,
} from './stage-form.schema';

const actorId = (req: Request): string | null => req.user?.userId ?? null;

export const listForWorkflow = async (req: Request, res: Response) => {
  const workflowId = req.params.id as string;
  res.json(
    await service.listForWorkflow(
      workflowId,
      req.query as unknown as ListBindingsQuery,
    ),
  );
};

export const create = async (req: Request, res: Response) => {
  const workflowId = req.params.id as string;
  const result = await service.createBinding(
    workflowId,
    req.body as CreateStageFormBindingInput,
    actorId(req),
  );
  res.status(201).json(result);
};

export const get = async (req: Request, res: Response) => {
  res.json(await service.getBinding(req.params.id as string));
};

export const update = async (req: Request, res: Response) => {
  res.json(
    await service.updateBinding(
      req.params.id as string,
      req.body as UpdateStageFormBindingInput,
    ),
  );
};

export const remove = async (req: Request, res: Response) => {
  await service.softDeleteBinding(req.params.id as string);
  res.status(204).send();
};

export const listForTicket = async (req: Request, res: Response) => {
  const userId = actorId(req);
  if (!userId) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  res.json(await service.listForTicket(req.params.id as string, userId));
};

export const listSubmittedForms = async (req: Request, res: Response) => {
  res.json(await service.listSubmittedFormsForTicket(req.params.id as string));
};

export const createWorkflowSubmission = async (req: Request, res: Response) => {
  const ticketId = req.params.id as string;
  const formId = req.params.formId as string;
  const userId = actorId(req);
  if (!userId) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  const result = await service.createWorkflowSubmission(
    ticketId,
    formId,
    req.body as CreateWorkflowSubmissionInput,
    userId,
  );
  res.status(201).json(result);
};
