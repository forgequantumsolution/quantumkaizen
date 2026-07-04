/**
 * LIMS 2.0 — Certificate of Analysis (CoA) API client. Backend: /api/coa,
 * public verify at /api/public/coa.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type CoaStatus = 'DRAFT' | 'ISSUED' | 'REVOKED';

export interface CoaResultLine {
  analyte_name: string;
  value: number | string | null;
  unit: string | null;
  evaluation: string;
  min_value: number | null;
  max_value: number | null;
}
export interface CoaTestBlock {
  test_name: string;
  status: string;
  review_status: string;
  overall_result: string | null;
  results: CoaResultLine[];
}
export interface Coa {
  id: string;
  coa_number: string;
  sample_id: string | null;
  product_name: string;
  batch_no: string | null;
  spec_version_id: string | null;
  template_id: string | null;
  customer_id: string | null;
  status: CoaStatus;
  verify_token: string | null;
  conclusion: string | null;
  issued_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  results?: CoaTestBlock[];
  customer_name?: string | null;
  template?: {
    id: string;
    name: string;
    title: string | null;
    header_html: string | null;
    footer_html: string | null;
    sections: string[];
  } | null;
}
export interface CoaTemplate {
  id: string;
  code: string;
  name: string;
  title: string | null;
  header_html: string | null;
  footer_html: string | null;
  sections: string[];
  customer_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GenerateCoaBody {
  sample_id: string;
  template_id?: string | null;
  customer_id?: string | null;
  conclusion?: string | null;
}
export interface CoaTemplateUpsert {
  name: string;
  title?: string | null;
  header_html?: string | null;
  footer_html?: string | null;
  sections?: string[];
  customer_id?: string | null;
  is_active?: boolean;
}
export interface CoaVerifyResult {
  valid: boolean;
  coa_number?: string;
  product_name?: string;
  batch_no?: string | null;
  status?: CoaStatus;
  issued_at?: string | null;
  conclusion?: string | null;
}

const keys = {
  all: ['coa'] as const,
  list: (p: object) => ['coa', 'list', p] as const,
  detail: (id: string) => ['coa', id] as const,
  templates: (p: object) => ['coa', 'templates', p] as const,
  templatesAll: ['coa', 'templates'] as const,
  verify: (token: string) => ['coa', 'verify', token] as const,
};

// ── CoA ──
export const useCoas = (params: { status?: CoaStatus; sample_id?: string; search?: string } = {}) =>
  useQuery<{ data: Coa[] }>({ queryKey: keys.list(params), queryFn: () => api.get('/coa', { params }).then((r) => r.data) });
export const useCoa = (id: string | undefined) =>
  useQuery<Coa>({ queryKey: keys.detail(id ?? ''), queryFn: () => api.get(`/coa/${id}`).then((r) => r.data), enabled: !!id });
export const useGenerateCoa = () => {
  const qc = useQueryClient();
  return useMutation<Coa, unknown, GenerateCoaBody>({ mutationFn: (b) => api.post('/coa/generate', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
export const useIssueCoa = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Coa, unknown, { credential?: string | null }>({ mutationFn: (b) => api.post(`/coa/${id}/issue`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};
export const useRevokeCoa = (id: string) => {
  const qc = useQueryClient();
  return useMutation<Coa, unknown, { reason?: string | null; credential?: string | null }>({ mutationFn: (b) => api.post(`/coa/${id}/revoke`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
};

// ── Templates ──
export const useCoaTemplates = (params: { search?: string } = {}) =>
  useQuery<{ data: CoaTemplate[] }>({ queryKey: keys.templates(params), queryFn: () => api.get('/coa/templates', { params }).then((r) => r.data) });
export const useCreateCoaTemplate = () => {
  const qc = useQueryClient();
  return useMutation<CoaTemplate, unknown, CoaTemplateUpsert>({ mutationFn: (b) => api.post('/coa/templates', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.templatesAll }) });
};
export const useUpdateCoaTemplate = (id: string) => {
  const qc = useQueryClient();
  return useMutation<CoaTemplate, unknown, CoaTemplateUpsert>({ mutationFn: (b) => api.put(`/coa/templates/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.templatesAll }) });
};
export const useDeleteCoaTemplate = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/coa/templates/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: keys.templatesAll }) });
};

// ── Public verify (no auth) ──
export const useVerifyCoa = (token: string | undefined) =>
  useQuery<CoaVerifyResult>({ queryKey: keys.verify(token ?? ''), queryFn: () => api.get(`/public/coa/verify/${token}`).then((r) => r.data), enabled: !!token, retry: false });

export const COA_STATUS_BADGE: Record<CoaStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  ISSUED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REVOKED: 'bg-red-50 text-red-700 border-red-200',
};
