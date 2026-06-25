import type { Request, Response } from 'express';
import * as service from './dms.service';
import type {
  ApproveInput,
  AssignReadersInput,
  CreateDocumentInput,
  IssueInput,
  ListDocumentsQuery,
  MarkReviewedInput,
  RejectInput,
  ReviseInput,
  SaveContentInput,
  UpdateDocumentInput,
} from './dms.schema';

const uid = (req: Request) => req.user?.userId;

export const list = async (req: Request, res: Response) => {
  res.json(await service.listDocuments(req.query as unknown as ListDocumentsQuery));
};

export const get = async (req: Request, res: Response) => {
  res.json(await service.getDocument(req.params.id as string));
};

export const create = async (req: Request, res: Response) => {
  res.status(201).json(await service.createDocument(req.body as CreateDocumentInput, uid(req)));
};

export const update = async (req: Request, res: Response) => {
  res.json(await service.updateDocument(req.params.id as string, req.body as UpdateDocumentInput, uid(req)));
};

export const saveContent = async (req: Request, res: Response) => {
  res.json(await service.saveContent(req.params.id as string, req.body as SaveContentInput, uid(req)));
};

export const revise = async (req: Request, res: Response) => {
  res.json(await service.reviseDocument(req.params.id as string, req.body as ReviseInput, uid(req)));
};

export const issue = async (req: Request, res: Response) => {
  res.json(await service.issueDocument(req.params.id as string, req.body as IssueInput, uid(req)));
};

export const submit = async (req: Request, res: Response) => {
  res.json(await service.submitForReview(req.params.id as string, uid(req)));
};

export const approve = async (req: Request, res: Response) => {
  res.json(await service.approveDocument(req.params.id as string, req.body as ApproveInput, uid(req)));
};

export const reject = async (req: Request, res: Response) => {
  res.json(await service.rejectDocument(req.params.id as string, req.body as RejectInput, uid(req)));
};

export const retire = async (req: Request, res: Response) => {
  res.json(await service.retireDocument(req.params.id as string, uid(req)));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteDocument(req.params.id as string, uid(req));
  res.status(204).send();
};

export const markReviewed = async (req: Request, res: Response) => {
  res.json(await service.markReviewed(req.params.id as string, req.body as MarkReviewedInput, uid(req)));
};

export const assignReaders = async (req: Request, res: Response) => {
  res.json(await service.assignReaders(req.params.id as string, req.body as AssignReadersInput, uid(req)));
};

export const acknowledge = async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  res.json(await service.acknowledgeRead(req.params.id as string, userId));
};

export const receipts = async (req: Request, res: Response) => {
  res.json(await service.listReceipts(req.params.id as string, uid(req)));
};

export const myReads = async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  res.json(await service.listMyPendingReads(userId));
};
