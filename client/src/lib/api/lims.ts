/**
 * LIMS API client — Lab Registry (first LIMS entity). Backend: /api/lims.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type LabType = 'INTERNAL' | 'PARTNER' | 'CONTRACT';

export interface Lab {
  id: string;
  code: string;
  name: string;
  type: LabType;
  gmp_class: string | null;
  site_code: string | null;
  location: string | null;
  accreditation: string | null;
  contact_name: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListLabsResponse {
  data: Lab[];
  total: number;
  page: number;
  page_size: number;
}

export interface LabUpsert {
  name: string;
  type: LabType;
  gmp_class?: string | null;
  site_code?: string | null;
  location?: string | null;
  accreditation?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  is_active?: boolean;
}

export interface ListLabsParams {
  type?: LabType;
  is_active?: boolean;
  search?: string;
}

const keys = {
  all: ['lims', 'labs'] as const,
  list: (p: ListLabsParams) => ['lims', 'labs', 'list', p] as const,
};

export const useLabs = (params: ListLabsParams = {}) =>
  useQuery<ListLabsResponse>({
    queryKey: keys.list(params),
    queryFn: () => api.get('/lims/labs', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });

export const useCreateLab = () => {
  const qc = useQueryClient();
  return useMutation<Lab, unknown, LabUpsert>({
    mutationFn: (body) => api.post('/lims/labs', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateLab = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Lab, unknown, LabUpsert>({
    mutationFn: (body) => api.put(`/lims/labs/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useDeleteLab = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/lims/labs/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const LAB_TYPE_LABELS: Record<LabType, string> = {
  INTERNAL: 'Internal',
  PARTNER: 'Partner',
  CONTRACT: 'Contract',
};

// ─── Equipment & Calibration ───────────────────────────────────────────────

export type EquipmentStatus = 'ACTIVE' | 'OUT_OF_SERVICE' | 'RETIRED';
export type CalibrationResult = 'PASS' | 'FAIL' | 'CONDITIONAL';

export interface CalibrationRecord {
  id: string;
  calibrated_at: string;
  result: CalibrationResult;
  certificate_no: string | null;
  next_due_at: string | null;
  performed_by: string | null;
  remarks: string | null;
  created_at: string;
}

export interface EquipmentSummary {
  id: string;
  code: string;
  name: string;
  category: string | null;
  lab_id: string | null;
  lab_name: string | null;
  serial_no: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  status: EquipmentStatus;
  calibration_frequency_days: number | null;
  last_calibrated_at: string | null;
  calibration_due_at: string | null;
  calibration_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentDetail extends EquipmentSummary {
  calibrations: CalibrationRecord[];
}

export interface EquipmentUpsert {
  name: string;
  category?: string | null;
  lab_id?: string | null;
  serial_no?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  location?: string | null;
  status?: EquipmentStatus;
  calibration_frequency_days?: number | null;
}

export interface RecordCalibrationBody {
  calibrated_at: string;
  result: CalibrationResult;
  certificate_no?: string | null;
  next_due_at?: string | null;
  performed_by?: string | null;
  remarks?: string | null;
}

export interface ListEquipmentParams {
  status?: EquipmentStatus;
  lab_id?: string;
  search?: string;
  calibration_due?: boolean;
}

const eqKeys = {
  all: ['lims', 'equipment'] as const,
  list: (p: ListEquipmentParams) => ['lims', 'equipment', 'list', p] as const,
  detail: (id: string) => ['lims', 'equipment', id] as const,
};

export const useEquipment = (params: ListEquipmentParams = {}) =>
  useQuery<{ data: EquipmentSummary[]; total: number }>({
    queryKey: eqKeys.list(params),
    queryFn: () => api.get('/lims/equipment', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });

export const useEquipmentItem = (id: string | undefined) =>
  useQuery<EquipmentDetail>({
    queryKey: eqKeys.detail(id ?? ''),
    queryFn: () => api.get(`/lims/equipment/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateEquipment = () => {
  const qc = useQueryClient();
  return useMutation<EquipmentDetail, unknown, EquipmentUpsert>({
    mutationFn: (body) => api.post('/lims/equipment', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: eqKeys.all }),
  });
};

export const useUpdateEquipment = (id: string) => {
  const qc = useQueryClient();
  return useMutation<EquipmentDetail, unknown, EquipmentUpsert>({
    mutationFn: (body) => api.put(`/lims/equipment/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: eqKeys.all }),
  });
};

export const useDeleteEquipment = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/lims/equipment/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: eqKeys.all }),
  });
};

export const useRecordCalibration = (id: string) => {
  const qc = useQueryClient();
  return useMutation<EquipmentDetail, unknown, RecordCalibrationBody>({
    mutationFn: (body) => api.post(`/lims/equipment/${id}/calibrations`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: eqKeys.all }),
  });
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  ACTIVE: 'Active',
  OUT_OF_SERVICE: 'Out of Service',
  RETIRED: 'Retired',
};

// ─── Certifications ────────────────────────────────────────────────────────

export type ExpiryState = 'valid' | 'expiring' | 'expired';

export interface Certification {
  id: string;
  code: string;
  type: string;
  number: string | null;
  lab_id: string | null;
  lab_name: string | null;
  issued_by: string | null;
  issue_date: string | null;
  expiry_date: string;
  days_to_expiry: number;
  expiry_state: ExpiryState;
  is_active: boolean;
}

export interface CertUpsert {
  type: string;
  number?: string | null;
  lab_id?: string | null;
  issued_by?: string | null;
  issue_date?: string | null;
  expiry_date: string;
  is_active?: boolean;
}

const certKeys = { all: ['lims', 'certs'] as const, list: (p: object) => ['lims', 'certs', p] as const };

export const useCertifications = (params: { search?: string; lab_id?: string; expiring?: boolean } = {}) =>
  useQuery<{ data: Certification[]; total: number }>({
    queryKey: certKeys.list(params),
    queryFn: () => api.get('/lims/certifications', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });
export const useCreateCertification = () => {
  const qc = useQueryClient();
  return useMutation<Certification, unknown, CertUpsert>({ mutationFn: (b) => api.post('/lims/certifications', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: certKeys.all }) });
};
export const useUpdateCertification = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Certification, unknown, CertUpsert>({ mutationFn: (b) => api.put(`/lims/certifications/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: certKeys.all }) });
};
export const useDeleteCertification = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/lims/certifications/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: certKeys.all }) });
};

// ─── Test Methods ──────────────────────────────────────────────────────────

export interface TestMethod {
  id: string;
  code: string;
  name: string;
  technique: string | null;
  sop_ref: string | null;
  document_id: string | null;
  description: string | null;
  default_unit: string | null;
  price: number | null;
  is_active: boolean;
}

export interface MethodUpsert {
  name: string;
  technique?: string | null;
  sop_ref?: string | null;
  document_id?: string | null;
  description?: string | null;
  default_unit?: string | null;
  price?: number | null;
  is_active?: boolean;
}

const methodKeys = { all: ['lims', 'methods'] as const, list: (p: object) => ['lims', 'methods', p] as const };

export const useMethods = (params: { search?: string } = {}) =>
  useQuery<{ data: TestMethod[]; total: number }>({
    queryKey: methodKeys.list(params),
    queryFn: () => api.get('/lims/methods', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });
export const useCreateMethod = () => {
  const qc = useQueryClient();
  return useMutation<TestMethod, unknown, MethodUpsert>({ mutationFn: (b) => api.post('/lims/methods', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: methodKeys.all }) });
};
export const useUpdateMethod = (id: string) => {
  const qc = useQueryClient();
  return useMutation<TestMethod, unknown, MethodUpsert>({ mutationFn: (b) => api.put(`/lims/methods/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: methodKeys.all }) });
};
export const useDeleteMethod = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/lims/methods/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: methodKeys.all }) });
};

// ─── Specification Library ─────────────────────────────────────────────────

export type SpecStatus = 'DRAFT' | 'APPROVED' | 'RETIRED';

export interface SpecParameter {
  id?: string;
  name: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  target_value: number | null;
  text_criteria: string | null;
  method_id: string | null;
  method_name?: string | null;
  pharmacopoeia_ref: string | null;
  position: number;
}

export interface SpecSummary {
  id: string;
  code: string;
  product_name: string;
  version: number;
  status: SpecStatus;
  pharmacopoeia: string | null;
  description: string | null;
  effective_date: string | null;
  approved_at: string | null;
  parameter_count: number;
  created_at: string;
}

export interface SpecDetail extends SpecSummary {
  parameters: SpecParameter[];
}

export interface SpecUpsert {
  product_name: string;
  pharmacopoeia?: string | null;
  description?: string | null;
  iso_standard_id?: string | null;
  parameters: Array<Omit<SpecParameter, 'id' | 'method_name'>>;
}

const specKeys = {
  all: ['lims', 'specs'] as const,
  list: (p: object) => ['lims', 'specs', 'list', p] as const,
  detail: (id: string) => ['lims', 'specs', id] as const,
};

export const useSpecs = (params: { search?: string; status?: SpecStatus } = {}) =>
  useQuery<{ data: SpecSummary[]; total: number }>({
    queryKey: specKeys.list(params),
    queryFn: () => api.get('/lims/specifications', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });
export const useSpec = (id: string | undefined) =>
  useQuery<SpecDetail>({
    queryKey: specKeys.detail(id ?? ''),
    queryFn: () => api.get(`/lims/specifications/${id}`).then((r) => r.data),
    enabled: !!id,
  });
export const useCreateSpec = () => {
  const qc = useQueryClient();
  return useMutation<SpecDetail, unknown, SpecUpsert>({ mutationFn: (b) => api.post('/lims/specifications', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: specKeys.all }) });
};
export const useUpdateSpec = (id: string) => {
  const qc = useQueryClient();
  return useMutation<SpecDetail, unknown, SpecUpsert>({ mutationFn: (b) => api.put(`/lims/specifications/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: specKeys.all }) });
};
export const useApproveSpec = (id: string) => {
  const qc = useQueryClient();
  return useMutation<SpecDetail, unknown, void>({ mutationFn: () => api.post(`/lims/specifications/${id}/approve`, {}).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: specKeys.all }) });
};
export const useRetireSpec = (id: string) => {
  const qc = useQueryClient();
  return useMutation<SpecDetail, unknown, void>({ mutationFn: () => api.post(`/lims/specifications/${id}/retire`, {}).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: specKeys.all }) });
};
export const useDeleteSpec = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/lims/specifications/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: specKeys.all }) });
};
