import type { Request, Response } from 'express';
import * as svc from './sample-testing.service';
import type {
  AssignTestsInput, EnterResultsInput, ReviewTestInput, DisposeSampleInput, StartTestInput,
  WorklistUpsertInput, ListSampleTestQuery, ListWorklistQuery,
} from './sample-testing.schema';

const uid = (req: Request) => req.user?.userId;

// Sample tests
export const assign = async (req: Request, res: Response) => res.status(201).json(await svc.assignTests(req.params.id as string, req.body as AssignTestsInput, uid(req)));
export const testsForSample = async (req: Request, res: Response) => res.json(await svc.getTestsForSample(req.params.id as string));
export const listTests = async (req: Request, res: Response) => res.json(await svc.listSampleTests(req.query as unknown as ListSampleTestQuery));
export const getTest = async (req: Request, res: Response) => res.json(await svc.getSampleTest(req.params.id as string));
export const startTest = async (req: Request, res: Response) => res.json(await svc.startTest(req.params.id as string, req.body as StartTestInput, uid(req)));
export const enterResults = async (req: Request, res: Response) => res.json(await svc.enterResults(req.params.id as string, req.body as EnterResultsInput, uid(req)));
export const reviewTest = async (req: Request, res: Response) => res.json(await svc.reviewTest(req.params.id as string, req.body as ReviewTestInput, uid(req)));
export const dispose = async (req: Request, res: Response) => res.json(await svc.disposeSample(req.params.id as string, req.body as DisposeSampleInput, uid(req)));

// Worklists
export const listWorklists = async (req: Request, res: Response) => res.json(await svc.listWorklists(req.query as unknown as ListWorklistQuery));
export const getWorklist = async (req: Request, res: Response) => res.json(await svc.getWorklist(req.params.id as string));
export const createWorklist = async (req: Request, res: Response) => res.status(201).json(await svc.createWorklist(req.body as WorklistUpsertInput, uid(req)));
export const updateWorklist = async (req: Request, res: Response) => res.json(await svc.updateWorklist(req.params.id as string, req.body as WorklistUpsertInput, uid(req)));
export const closeWorklist = async (req: Request, res: Response) => res.json(await svc.closeWorklist(req.params.id as string, uid(req)));
export const removeTestFromWorklist = async (req: Request, res: Response) => { await svc.removeTestFromWorklist(req.params.id as string, uid(req)); res.status(204).send(); };
