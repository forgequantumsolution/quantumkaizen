import type { Request, Response } from 'express';
import * as service from './submission.service';
import { ok, success } from './dynamic-form.response';
import type {
  ListSubmissionsQuery,
  SubmitFormInput,
  UpdateSubmissionStatusInput,
} from './submission.schema';

export const submit = async (req: Request, res: Response) => {
  const data = await service.submit(
    req.params.formId as string,
    req.body as SubmitFormInput,
    req.user?.userId
  );
  success(res, 'Submission saved', data, 201);
};

export const list = async (req: Request, res: Response) => {
  const data = await service.list(req.query as unknown as ListSubmissionsQuery);
  ok(res, data);
};

export const get = async (req: Request, res: Response) => {
  const data = await service.get(req.params.id as string, req.user?.userId);
  ok(res, data);
};

export const updateStatus = async (req: Request, res: Response) => {
  const data = await service.updateStatus(
    req.params.id as string,
    req.body as UpdateSubmissionStatusInput
  );
  success(res, 'Status updated', data);
};

export const remove = async (req: Request, res: Response) => {
  await service.remove(req.params.id as string);
  success(res, 'Submission deleted');
};
