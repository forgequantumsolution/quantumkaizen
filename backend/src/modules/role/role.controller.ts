import type { Request, Response } from 'express';
import * as service from './role.service';
import type { ListQuery } from './role.schema';
import { resolveSiteScope, siteFilterFor } from '../../middleware/permissions';

export const list = async (req: Request, res: Response) => {
  res.json(await service.list(req.query as unknown as ListQuery));
};

export const get = async (req: Request, res: Response) => {
  res.json(await service.getById(req.params.id as string));
};

export const directory = async (req: Request, res: Response) => {
  // Site-scoped (docs/access-control-data-scoping-plan.md + workflow-site-ownership
  // Phase D): roles have no site column, so "roles in a site" = roles held by ≥1
  // active user in that site. A scoped caller sees roles present in their own
  // site(s); viewAll sees all. Optional `?siteId=` targets a specific site (e.g. the
  // workflow builder scoping to the workflow's site), bounded to the caller's scope.
  const uid = req.user?.userId;
  if (!uid) {
    res.json(await service.directory(null));
    return;
  }
  const scope = await resolveSiteScope(uid);
  const requestedSiteId = typeof req.query.siteId === 'string' ? req.query.siteId : undefined;
  const filter = siteFilterFor(scope, requestedSiteId);
  res.json(await service.directory(filter ? filter.in : null));
};

export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.create(req.body));
};

export const patch = async (req: Request, res: Response) => {
  res.json(await service.update(req.params.id as string, req.body));
};

export const setPermissions = async (req: Request, res: Response) => {
  res.json(await service.setPermissions(req.params.id as string, req.body));
};

export const remove = async (req: Request, res: Response) => {
  await service.remove(req.params.id as string);
  res.status(204).send();
};
