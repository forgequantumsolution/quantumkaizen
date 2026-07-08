import type { Request, Response } from 'express';
import * as service from './ticket.service';
import {
  getEffectivePermissionKeys,
  ticketReadScope,
  resolveSiteScope,
  canUseSite,
} from '../../middleware/permissions';
import { Forbidden, NotFound } from '../../lib/httpError';
import type {
  AddCommentInput,
  AttachDocInput,
  HoldBody,
  ListCommentsQuery,
  ListTicketsQuery,
  RaiseTicketInput,
  SpawnChildInput,
  TransitionBody,
  UpdateTicketInput,
} from './ticket.schema';

const userId = (req: Request): string => {
  const id = req.user?.userId;
  if (!id) throw new Error('Missing user on request after requireAuth');
  return id;
};

export const list = async (req: Request, res: Response) => {
  const keys = await getEffectivePermissionKeys(userId(req));
  const scope = ticketReadScope(keys);
  const siteScope = await resolveSiteScope(userId(req));
  res.json(
    await service.list(req.query as unknown as ListTicketsQuery, userId(req), scope, siteScope),
  );
};

export const get = async (req: Request, res: Response) => {
  const ticket = await service.getById(req.params.id as string);
  // Hard site boundary: a scoped user can't open another site's ticket by URL.
  // 404 (not 403) so we don't leak that a ticket exists in a site they can't see.
  const siteScope = await resolveSiteScope(userId(req));
  if (!siteScope.all && ticket.site?.id && !siteScope.siteIds.includes(ticket.site.id)) {
    throw NotFound('Ticket not found');
  }
  res.json(ticket);
};

export const create = async (req: Request, res: Response) => {
  const body = req.body as RaiseTicketInput;
  if (body.siteId) {
    const siteScope = await resolveSiteScope(userId(req));
    if (!canUseSite(siteScope, body.siteId)) {
      throw Forbidden('You cannot create tickets in the selected site');
    }
  }
  const result = await service.raiseTicket(body, userId(req));
  res.status(201).json(result);
};

export const patch = async (req: Request, res: Response) => {
  const body = req.body as UpdateTicketInput;
  if (body.siteId) {
    const siteScope = await resolveSiteScope(userId(req));
    if (!canUseSite(siteScope, body.siteId)) {
      throw Forbidden('You cannot move this ticket to the selected site');
    }
  }
  res.json(await service.update(req.params.id as string, body));
};

export const remove = async (req: Request, res: Response) => {
  await service.softDelete(req.params.id as string, userId(req));
  res.status(204).send();
};

// Engine
export const allowedActions = async (req: Request, res: Response) => {
  res.json(await service.allowedActions(req.params.id as string, userId(req)));
};

export const transition = async (req: Request, res: Response) => {
  res.json(
    await service.transition(req.params.id as string, req.body as TransitionBody, userId(req))
  );
};

export const hold = async (req: Request, res: Response) => {
  await service.hold(req.params.id as string, req.body as HoldBody, userId(req));
  res.status(204).send();
};

export const resume = async (req: Request, res: Response) => {
  await service.resume(req.params.id as string, userId(req));
  res.status(204).send();
};

// Tracking / timeline
export const track = async (req: Request, res: Response) => {
  res.json(await service.track(req.params.id as string));
};

export const timeline = async (req: Request, res: Response) => {
  res.json(await service.timeline(req.params.id as string));
};

export const participants = async (req: Request, res: Response) => {
  res.json(await service.participants(req.params.id as string));
};

// Comments
export const addComment = async (req: Request, res: Response) => {
  const result = await service.addComment(
    req.params.id as string,
    req.body as AddCommentInput,
    userId(req)
  );
  res.status(201).json(result);
};

export const listComments = async (req: Request, res: Response) => {
  res.json(
    await service.listComments(
      req.params.id as string,
      req.query as unknown as ListCommentsQuery
    )
  );
};

export const deleteComment = async (req: Request, res: Response) => {
  // TODO: detect admin via permission set; for now treat null as non-admin
  await service.deleteComment(
    req.params.id as string,
    req.params.commentId as string,
    userId(req),
    false
  );
  res.status(204).send();
};

// Docs
export const attachDoc = async (req: Request, res: Response) => {
  const result = await service.attachDoc(
    req.params.id as string,
    req.body as AttachDocInput,
    userId(req)
  );
  res.status(201).json(result);
};

export const listDocs = async (req: Request, res: Response) => {
  res.json(await service.listDocs(req.params.id as string));
};

export const deleteDoc = async (req: Request, res: Response) => {
  await service.deleteDoc(req.params.id as string, req.params.docId as string);
  res.status(204).send();
};

// Spawn child
export const spawnChild = async (req: Request, res: Response) => {
  const result = await service.spawnChild(
    req.params.id as string,
    req.body as SpawnChildInput,
    userId(req)
  );
  res.status(201).json(result);
};
