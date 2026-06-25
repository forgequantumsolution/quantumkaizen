import type { Request, Response } from 'express';
import * as service from './sample.service';
import type {
  AddAliquotInput, AddCustodyInput, ListSampleQuery, ListStorageQuery,
  RegisterSampleInput, StorageUpsertInput, TransitionSampleInput, UpdateSampleInput,
} from './sample.schema';

const uid = (req: Request) => req.user?.userId;

// Storage
export const listStorage = async (req: Request, res: Response) => res.json(await service.listStorage(req.query as unknown as ListStorageQuery));
export const createStorage = async (req: Request, res: Response) => res.status(201).json(await service.createStorage(req.body as StorageUpsertInput, uid(req)));
export const updateStorage = async (req: Request, res: Response) => res.json(await service.updateStorage(req.params.id as string, req.body as StorageUpsertInput, uid(req)));
export const removeStorage = async (req: Request, res: Response) => { await service.deleteStorage(req.params.id as string, uid(req)); res.status(204).send(); };

// Samples
export const list = async (req: Request, res: Response) => res.json(await service.listSamples(req.query as unknown as ListSampleQuery));
export const get = async (req: Request, res: Response) => res.json(await service.getSample(req.params.id as string));
export const register = async (req: Request, res: Response) => res.status(201).json(await service.registerSample(req.body as RegisterSampleInput, uid(req)));
export const update = async (req: Request, res: Response) => res.json(await service.updateSample(req.params.id as string, req.body as UpdateSampleInput, uid(req)));
export const transition = async (req: Request, res: Response) => res.json(await service.transitionSample(req.params.id as string, req.body as TransitionSampleInput, uid(req)));
export const addCustody = async (req: Request, res: Response) => res.json(await service.addCustody(req.params.id as string, req.body as AddCustodyInput, uid(req)));
export const addAliquot = async (req: Request, res: Response) => res.json(await service.addAliquot(req.params.id as string, req.body as AddAliquotInput, uid(req)));
export const remove = async (req: Request, res: Response) => { await service.deleteSample(req.params.id as string, uid(req)); res.status(204).send(); };
