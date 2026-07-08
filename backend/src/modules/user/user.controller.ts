import type { Request, Response } from 'express';
import * as service from './user.service';
import type { ListQuery } from './user.schema';
import { resolveSiteScope } from '../../middleware/permissions';

const userId = (req: Request): string => {
  const id = req.user?.userId;
  if (!id) throw new Error('Missing user on request after requireAuth');
  return id;
};

export const list = async (req: Request, res: Response) => {
  res.json(await service.list(req.query as unknown as ListQuery));
};

export const get = async (req: Request, res: Response) => {
  res.json(await service.getById(req.params.id as string));
};

export const directory = async (req: Request, res: Response) => {
  // Site-scoped: a user pinned to a site only sees colleagues in their own
  // site(s); viewAll holders see everyone. Mirrors ticket site scoping.
  const scope = await resolveSiteScope(userId(req));
  res.json(await service.directory(scope.all ? null : scope.siteIds));
};

export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.create(req.body));
};

export const patch = async (req: Request, res: Response) => {
  res.json(await service.update(req.params.id as string, req.body));
};

export const resetPassword = async (req: Request, res: Response) => {
  await service.resetPassword(req.params.id as string, req.body);
  res.status(204).send();
};

export const remove = async (req: Request, res: Response) => {
  res.json(await service.deactivate(req.params.id as string));
};

export const getPermissions = async (req: Request, res: Response) => {
  res.json(await service.getPermissions(req.params.id as string));
};

export const setPermissions = async (req: Request, res: Response) => {
  res.json(await service.setOverrides(req.params.id as string, req.body, req.user?.userId));
};
