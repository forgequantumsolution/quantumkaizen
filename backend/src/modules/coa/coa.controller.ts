import type { Request, Response } from 'express';
import * as svc from './coa.service';
import type { CoaTemplateUpsertInput, GenerateCoaInput, IssueCoaInput, RevokeCoaInput, ListCoaQuery, ListTemplateQuery } from './coa.schema';

const uid = (req: Request) => req.user?.userId;

// Templates
export const listTemplates = async (req: Request, res: Response) => res.json(await svc.listTemplates(req.query as unknown as ListTemplateQuery));
export const createTemplate = async (req: Request, res: Response) => res.status(201).json(await svc.createTemplate(req.body as CoaTemplateUpsertInput, uid(req)));
export const updateTemplate = async (req: Request, res: Response) => res.json(await svc.updateTemplate(req.params.id as string, req.body as CoaTemplateUpsertInput, uid(req)));
export const removeTemplate = async (req: Request, res: Response) => { await svc.deleteTemplate(req.params.id as string, uid(req)); res.status(204).send(); };

// Certificates
export const list = async (req: Request, res: Response) => res.json(await svc.listCoas(req.query as unknown as ListCoaQuery));
export const get = async (req: Request, res: Response) => res.json(await svc.getCoa(req.params.id as string));
export const generate = async (req: Request, res: Response) => res.status(201).json(await svc.generateCoa(req.body as GenerateCoaInput, uid(req)));
export const issue = async (req: Request, res: Response) => res.json(await svc.issueCoa(req.params.id as string, req.body as IssueCoaInput, uid(req)));
export const revoke = async (req: Request, res: Response) => res.json(await svc.revokeCoa(req.params.id as string, req.body as RevokeCoaInput, uid(req)));

// Public verification (no auth)
export const verify = async (req: Request, res: Response) => res.json(await svc.verifyByToken(req.params.token as string));
