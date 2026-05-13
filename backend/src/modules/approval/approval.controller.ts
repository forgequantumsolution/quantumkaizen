import type { Request, Response } from 'express';
import { Unauthorized } from '../../lib/httpError';
import * as service from './approval.service';
import type {
  CreateApprovalPolicyInput,
  DecideApprovalInput,
  UpdateApprovalPolicyInput,
} from './approval.schema';

// ─── Policies ──────────────────────────────────────────────────────────────

export const listPolicies = async (req: Request, res: Response) => {
  const workflowId = req.params.id as string;
  const includeInactive = req.query.includeInactive === 'true';
  const includeDeleted = req.query.includeDeleted === 'true';
  res.json(await service.listPoliciesForWorkflow(workflowId, { includeInactive, includeDeleted }));
};

export const getPolicy = async (req: Request, res: Response) => {
  res.json(await service.getPolicy(req.params.id as string));
};

export const createPolicy = async (req: Request, res: Response) => {
  const workflowId = req.params.id as string;
  const body = req.body as CreateApprovalPolicyInput;
  res.status(201).json(await service.createPolicy(workflowId, body));
};

export const updatePolicy = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const body = req.body as UpdateApprovalPolicyInput;
  res.json(await service.updatePolicy(id, body));
};

export const deletePolicy = async (req: Request, res: Response) => {
  await service.softDeletePolicy(req.params.id as string);
  res.status(204).send();
};

// ─── Instances (read-only — `decide` lands in P3.5 with engine intercept) ──

export const listTicketApprovals = async (req: Request, res: Response) => {
  res.json(await service.listApprovalsForTicket(req.params.id as string));
};

export const getInstance = async (req: Request, res: Response) => {
  res.json(await service.getInstance(req.params.instanceId as string));
};

export const decideInstance = async (req: Request, res: Response) => {
  if (!req.user) throw Unauthorized();
  const instanceId = req.params.instanceId as string;
  const body = req.body as DecideApprovalInput;
  res.json(
    await service.decideInstance(instanceId, body, {
      id: req.user.userId,
      email: req.user.email,
    }),
  );
};
