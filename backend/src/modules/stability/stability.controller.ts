import type { Request, Response } from 'express';
import * as svc from './stability.service';
import type { StudyUpsertInput, ListStudyQuery, ConditionInput } from './stability.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => res.json(await svc.listStudies(req.query as unknown as ListStudyQuery));
export const get = async (req: Request, res: Response) => res.json(await svc.getStudy(req.params.id as string));
export const create = async (req: Request, res: Response) => res.status(201).json(await svc.createStudy(req.body as StudyUpsertInput, uid(req)));
export const update = async (req: Request, res: Response) => res.json(await svc.updateStudy(req.params.id as string, req.body as StudyUpsertInput, uid(req)));
export const addCondition = async (req: Request, res: Response) => res.json(await svc.addCondition(req.params.id as string, req.body as ConditionInput, uid(req)));
export const activate = async (req: Request, res: Response) => res.json(await svc.activateStudy(req.params.id as string, req.body?.start_date ?? undefined, uid(req)));
export const pull = async (req: Request, res: Response) => res.json(await svc.pullTimepoint(req.params.id as string, uid(req)));
export const complete = async (req: Request, res: Response) => res.json(await svc.completeStudy(req.params.id as string, uid(req)));
