import type { Request, Response } from 'express';
import * as service from './dynamic-form.service';
import { ok, success } from './dynamic-form.response';
import type {
  CreateFormInput,
  FieldTypeUpsert,
  FormTypeUpsert,
  ListFormsQuery,
  SaveDraftInput,
  SaveFormFieldsInput,
} from './dynamic-form.schema';

// ───── Forms ─────
export const listForms = async (req: Request, res: Response) => {
  const data = await service.listForms(req.query as unknown as ListFormsQuery);
  ok(res, data);
};

export const getFormFields = async (req: Request, res: Response) => {
  const data = await service.getFormFields(req.params.id as string);
  ok(res, data);
};

export const getFormDraft = async (req: Request, res: Response) => {
  const data = await service.getFormDraft(req.params.id as string);
  ok(res, data);
};

export const createForm = async (req: Request, res: Response) => {
  const data = await service.createForm(req.body as CreateFormInput, req.user?.userId);
  success(res, 'Form created', data, 201);
};

export const saveFormFields = async (req: Request, res: Response) => {
  const result = await service.saveFormFields(
    req.params.id as string,
    req.body as SaveFormFieldsInput
  );
  const msg = result.version_bumped
    ? `Form saved as v${result.version}`
    : 'Form saved';
  success(res, msg, result);
};

export const saveDraft = async (req: Request, res: Response) => {
  await service.saveDraft(
    req.params.id as string,
    req.body as SaveDraftInput,
    req.user?.userId
  );
  success(res, 'Draft saved');
};

export const deleteForm = async (req: Request, res: Response) => {
  await service.deleteForm(req.params.id as string);
  success(res, 'Form deleted');
};

// ───── Form types ─────
export const listFormTypes = async (req: Request, res: Response) => {
  const data = await service.listFormTypes(req.query.search as string | undefined);
  ok(res, { data });
};

export const createFormType = async (req: Request, res: Response) => {
  const created = await service.createFormType(req.body as FormTypeUpsert);
  success(res, 'Form type created', created, 201);
};

export const updateFormType = async (req: Request, res: Response) => {
  await service.updateFormType(req.params.id as string, req.body as FormTypeUpsert);
  success(res, 'Form type updated');
};

export const deleteFormType = async (req: Request, res: Response) => {
  await service.deleteFormType(req.params.id as string);
  success(res, 'Form type deleted');
};

// ───── Field types ─────
export const listFieldTypes = async (req: Request, res: Response) => {
  const data = await service.listFieldTypes(req.query.search as string | undefined);
  ok(res, { field_types: data });
};

export const createFieldType = async (req: Request, res: Response) => {
  await service.createFieldType(req.body as FieldTypeUpsert);
  success(res, 'Field type created', undefined, 201);
};

export const updateFieldType = async (req: Request, res: Response) => {
  await service.updateFieldType(req.params.id as string, req.body as FieldTypeUpsert);
  success(res, 'Field type updated');
};

export const deleteFieldType = async (req: Request, res: Response) => {
  await service.deleteFieldType(req.params.id as string);
  success(res, 'Field type deleted');
};

// ───── Lookups ─────
export const listDataTypes = async (_req: Request, res: Response) => {
  const data = await service.listDataTypes();
  ok(res, { data_types: data });
};

export const listMainProcesses = async (_req: Request, res: Response) => {
  ok(res, await service.listMainProcesses());
};

export const listCriteria = async (_req: Request, res: Response) => {
  ok(res, await service.listCriteria());
};
