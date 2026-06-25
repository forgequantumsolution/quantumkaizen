import type { Request, Response } from 'express';
import * as svc from './qc.service';
import type { QcMaterialUpsertInput, ListQcMaterialQuery, RecordQcResultInput } from './qc.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => res.json(await svc.listMaterials(req.query as unknown as ListQcMaterialQuery));
export const create = async (req: Request, res: Response) => res.status(201).json(await svc.createMaterial(req.body as QcMaterialUpsertInput, uid(req)));
export const update = async (req: Request, res: Response) => res.json(await svc.updateMaterial(req.params.id as string, req.body as QcMaterialUpsertInput, uid(req)));
export const remove = async (req: Request, res: Response) => { await svc.deleteMaterial(req.params.id as string, uid(req)); res.status(204).send(); };
export const record = async (req: Request, res: Response) => res.status(201).json(await svc.recordResult(req.params.id as string, req.body as RecordQcResultInput, uid(req)));
export const chart = async (req: Request, res: Response) => res.json(await svc.getChart(req.params.id as string, req.query.limit ? Number(req.query.limit) : 60));
