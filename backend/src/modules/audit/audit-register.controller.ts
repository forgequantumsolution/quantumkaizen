import type { Request, Response } from 'express';
import * as service from './audit-register.service';
import { listAuditComplianceResults } from './audit-compliance-sync.service';
import { success } from '../dynamic-form/dynamic-form.response';
import type {
  AuditMasterUpsertInput,
  AuditRegisterUpsertInput,
  AuditTypeMasterUpsertInput,
  CompleteAuditProgramInput,
  FindingUpsertInput,
  FocusAreaUpsertInput,
  ListAuditMasterQuery,
  ListAuditProgramQuery,
  ListAuditRegisterQuery,
  ListAuditTypeMasterQuery,
  ListFindingQuery,
  ListFocusAreaQuery,
  ListNcQuery,
  PromoteFindingToNcInput,
  RaiseCapaInput,
  RejectAuditRegisterInput,
  StartAuditProgramInput,
  UpdateNcStatusInput,
} from './audit.schema';

// ── Audit Master ──
export const listMasters = async (req: Request, res: Response) => {
  res.json(await service.listAuditMasters(req.query as unknown as ListAuditMasterQuery));
};
export const createMaster = async (req: Request, res: Response) => {
  const data = await service.createAuditMaster(req.body as AuditMasterUpsertInput, req.user?.userId);
  success(res, 'Audit master created', data, 201);
};
export const updateMaster = async (req: Request, res: Response) => {
  const data = await service.updateAuditMaster(req.params.id as string, req.body as AuditMasterUpsertInput);
  success(res, 'Audit master updated', data);
};
export const deleteMaster = async (req: Request, res: Response) => {
  await service.deleteAuditMaster(req.params.id as string);
  success(res, 'Audit master deleted');
};

// ── Focus Area ──
export const listFocusAreas = async (req: Request, res: Response) => {
  res.json(await service.listFocusAreas(req.query as unknown as ListFocusAreaQuery));
};
export const createFocusArea = async (req: Request, res: Response) => {
  const data = await service.createFocusArea(req.body as FocusAreaUpsertInput);
  success(res, 'Focus area created', data, 201);
};
export const updateFocusArea = async (req: Request, res: Response) => {
  const data = await service.updateFocusArea(req.params.id as string, req.body as FocusAreaUpsertInput);
  success(res, 'Focus area updated', data);
};
export const deleteFocusArea = async (req: Request, res: Response) => {
  await service.deleteFocusArea(req.params.id as string);
  success(res, 'Focus area deleted');
};

// ── Audit Type ──
export const listAuditTypes = async (req: Request, res: Response) => {
  res.json(await service.listAuditTypeMasters(req.query as unknown as ListAuditTypeMasterQuery));
};
export const createAuditType = async (req: Request, res: Response) => {
  const data = await service.createAuditTypeMaster(req.body as AuditTypeMasterUpsertInput);
  success(res, 'Audit type created', data, 201);
};
export const updateAuditType = async (req: Request, res: Response) => {
  const data = await service.updateAuditTypeMaster(req.params.id as string, req.body as AuditTypeMasterUpsertInput);
  success(res, 'Audit type updated', data);
};
export const deleteAuditType = async (req: Request, res: Response) => {
  await service.deleteAuditTypeMaster(req.params.id as string);
  success(res, 'Audit type deleted');
};

// ── Audit Register ──
export const listRegisters = async (req: Request, res: Response) => {
  res.json(await service.listAuditRegisters(req.query as unknown as ListAuditRegisterQuery));
};
export const getRegister = async (req: Request, res: Response) => {
  res.json({ data: await service.getAuditRegister(req.params.id as string) });
};
export const createRegister = async (req: Request, res: Response) => {
  const data = await service.createAuditRegister(req.body as AuditRegisterUpsertInput, req.user?.userId);
  success(res, 'Audit register created', data, 201);
};
export const updateRegister = async (req: Request, res: Response) => {
  const data = await service.updateAuditRegister(req.params.id as string, req.body as AuditRegisterUpsertInput);
  success(res, 'Audit register updated', data);
};
export const submitRegister = async (req: Request, res: Response) => {
  const data = await service.submitAuditRegister(req.params.id as string);
  success(res, 'Audit register submitted for approval', data);
};
export const approveRegister = async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const data = await service.approveAuditRegister(req.params.id as string, req.user.userId);
  success(res, 'Audit register approved', data);
};
export const rejectRegister = async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const data = await service.rejectAuditRegister(
    req.params.id as string,
    req.body as RejectAuditRegisterInput,
    req.user.userId
  );
  success(res, 'Audit register rejected', data);
};
export const deleteRegister = async (req: Request, res: Response) => {
  await service.deleteAuditRegister(req.params.id as string);
  success(res, 'Audit register deleted');
};

// ── Audit Program ──
export const listPrograms = async (req: Request, res: Response) => {
  res.json(await service.listAuditPrograms(req.query as unknown as ListAuditProgramQuery));
};
export const getProgram = async (req: Request, res: Response) => {
  res.json({ data: await service.getAuditProgram(req.params.id as string) });
};
export const startProgram = async (req: Request, res: Response) => {
  const data = await service.startAuditProgram(
    req.params.id as string,
    req.body as StartAuditProgramInput
  );
  success(res, 'Audit program started', data);
};
export const completeProgram = async (req: Request, res: Response) => {
  const data = await service.completeAuditProgram(
    req.params.id as string,
    req.body as CompleteAuditProgramInput
  );
  success(res, 'Audit program completed', data);
};

// ── Findings ──
export const listFindings = async (req: Request, res: Response) => {
  res.json(await service.listFindings(req.query as unknown as ListFindingQuery));
};
export const createFinding = async (req: Request, res: Response) => {
  const data = await service.createFinding(req.body as FindingUpsertInput, req.user?.userId);
  success(res, 'Finding recorded', data, 201);
};
export const updateFinding = async (req: Request, res: Response) => {
  await service.updateFinding(req.params.id as string, req.body as FindingUpsertInput);
  success(res, 'Finding updated');
};
export const deleteFinding = async (req: Request, res: Response) => {
  await service.deleteFinding(req.params.id as string);
  success(res, 'Finding deleted');
};

// ── Non-Conformance ──
export const promoteToNc = async (req: Request, res: Response) => {
  const data = await service.promoteFindingToNc(
    req.params.findingId as string,
    req.body as PromoteFindingToNcInput,
    req.user?.userId
  );
  success(res, 'Non-conformance raised', data, 201);
};
export const listNcs = async (req: Request, res: Response) => {
  res.json(await service.listNcs(req.query as unknown as ListNcQuery));
};
export const raiseCapa = async (req: Request, res: Response) => {
  const data = await service.raiseCapa(req.params.id as string, req.body as RaiseCapaInput);
  success(res, 'CAPA ticket linked', data);
};
export const updateNcStatus = async (req: Request, res: Response) => {
  const data = await service.updateNcStatus(req.params.id as string, req.body as UpdateNcStatusInput);
  success(res, 'Non-conformance updated', data);
};
export const listComplianceResults = async (req: Request, res: Response) => {
  const { register_id, program_id } = req.query as { register_id?: string; program_id?: string };
  res.json(await listAuditComplianceResults({ register_id, program_id }));
};
