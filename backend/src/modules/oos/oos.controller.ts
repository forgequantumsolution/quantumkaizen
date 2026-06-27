import type { Request, Response } from 'express';
import * as svc from './oos.service';
import type { OpenInvestigationInput, UpdateInvestigationInput, AdvancePhaseInput, CloseInvestigationInput, CreateCapaFromOosInput, ListInvestigationQuery } from './oos.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => res.json(await svc.listInvestigations(req.query as unknown as ListInvestigationQuery));
export const get = async (req: Request, res: Response) => res.json(await svc.getInvestigation(req.params.id as string));
export const open = async (req: Request, res: Response) => res.status(201).json(await svc.openInvestigation(req.body as OpenInvestigationInput, uid(req)));
export const update = async (req: Request, res: Response) => res.json(await svc.updateInvestigation(req.params.id as string, req.body as UpdateInvestigationInput, uid(req)));
export const advance = async (req: Request, res: Response) => res.json(await svc.advancePhase(req.params.id as string, req.body as AdvancePhaseInput, uid(req)));
export const close = async (req: Request, res: Response) => res.json(await svc.closeInvestigation(req.params.id as string, req.body as CloseInvestigationInput, uid(req)));
export const createCapa = async (req: Request, res: Response) => res.status(201).json(await svc.createCapaForInvestigation(req.params.id as string, req.body as CreateCapaFromOosInput, uid(req)));
