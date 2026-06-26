/**
 * LIMS — Sample lifecycle API client. Backend: /api/samples.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type SampleStatus = 'REGISTERED' | 'IN_TESTING' | 'IN_REVIEW' | 'RELEASED' | 'REJECTED' | 'CANCELLED';
export type CustodyAction = 'REGISTERED' | 'RECEIVED' | 'TRANSFERRED' | 'STORED' | 'ALIQUOTED' | 'RETURNED' | 'DISPOSED';

export interface StorageLocation {
  id: string; code: string; name: string; type: string | null; temp_zone: string | null; location: string | null; is_active: boolean;
}
export interface StorageUpsert { name: string; type?: string | null; temp_zone?: string | null; location?: string | null; is_active?: boolean; }

export interface CustodyEvent {
  id: string; action: CustodyAction; from_location_name: string | null; to_location_name: string | null; handler_name: string | null; occurred_at: string; remarks: string | null;
}
export interface Aliquot {
  id: string; code: string; storage_location_name: string | null; temp_zone: string | null; quantity: number | null; unit: string | null; expiry_at: string | null; status: string; created_at: string;
}
export interface SampleSummary {
  id: string; sample_number: string; barcode: string; product_name: string; product_id: string | null; batch_no: string | null; sample_type: string | null;
  source_site: string | null; specification_id: string | null; quantity: number | null; unit: string | null;
  collected_at: string | null; received_at: string | null; status: SampleStatus; lab_id: string | null;
  current_location_id: string | null; priority: string | null; remarks: string | null; aliquot_count: number;
  created_at: string; updated_at: string;
}
export interface SampleDetail extends SampleSummary {
  current_location_name: string | null; specification_label: string | null; lab_name: string | null;
  custody_events: CustodyEvent[]; aliquots: Aliquot[];
}
export interface RegisterSampleBody {
  product_name: string; product_id?: string | null; batch_no?: string | null; sample_type?: string | null; source_site?: string | null;
  specification_id?: string | null; quantity?: number | null; unit?: string | null; collected_at?: string | null;
  received_at?: string | null; lab_id?: string | null; current_location_id?: string | null; priority?: string | null; remarks?: string | null;
}

const keys = {
  all: ['samples'] as const,
  list: (p: object) => ['samples', 'list', p] as const,
  detail: (id: string) => ['samples', id] as const,
  storage: ['samples', 'storage'] as const,
};

// ── Storage ──
export const useStorageLocations = (params: { search?: string } = {}) =>
  useQuery<{ data: StorageLocation[] }>({ queryKey: [...keys.storage, params], queryFn: () => api.get('/samples/storage-locations', { params }).then((r) => r.data) });
export const useCreateStorage = () => { const qc = useQueryClient(); return useMutation<StorageLocation, unknown, StorageUpsert>({ mutationFn: (b) => api.post('/samples/storage-locations', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.storage }) }); };
export const useUpdateStorage = (id: string) => { const qc = useQueryClient(); return useMutation<StorageLocation, unknown, StorageUpsert>({ mutationFn: (b) => api.put(`/samples/storage-locations/${id}`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.storage }) }); };
export const useDeleteStorage = () => { const qc = useQueryClient(); return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/samples/storage-locations/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: keys.storage }) }); };

// ── Samples ──
export const useSamples = (params: { status?: SampleStatus; search?: string; lab_id?: string } = {}) =>
  useQuery<{ data: SampleSummary[]; total: number }>({ queryKey: keys.list(params), queryFn: () => api.get('/samples', { params: { ...params, page_size: 200 } }).then((r) => r.data) });
export const useSample = (id: string | undefined) =>
  useQuery<SampleDetail>({ queryKey: keys.detail(id ?? ''), queryFn: () => api.get(`/samples/${id}`).then((r) => r.data), enabled: !!id });
export const useRegisterSample = () => { const qc = useQueryClient(); return useMutation<SampleDetail, unknown, RegisterSampleBody>({ mutationFn: (b) => api.post('/samples', b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) }); };
export const useTransitionSample = (id: string) => { const qc = useQueryClient(); return useMutation<SampleDetail, unknown, { status: SampleStatus; remarks?: string | null }>({ mutationFn: (b) => api.post(`/samples/${id}/transition`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) }); };
export const useAddCustody = (id: string) => { const qc = useQueryClient(); return useMutation<SampleDetail, unknown, { action: CustodyAction; from_location_id?: string | null; to_location_id?: string | null; handler_name?: string | null; remarks?: string | null }>({ mutationFn: (b) => api.post(`/samples/${id}/custody`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) }); };
export const useAddAliquot = (id: string) => { const qc = useQueryClient(); return useMutation<SampleDetail, unknown, { storage_location_id?: string | null; temp_zone?: string | null; quantity?: number | null; unit?: string | null; expiry_at?: string | null }>({ mutationFn: (b) => api.post(`/samples/${id}/aliquots`, b).then((r) => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) }); };
export const useDeleteSample = () => { const qc = useQueryClient(); return useMutation<void, unknown, string>({ mutationFn: (id) => api.delete(`/samples/${id}`).then(() => undefined), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) }); };

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
  REGISTERED: 'Registered', IN_TESTING: 'In Testing', IN_REVIEW: 'In Review', RELEASED: 'Released', REJECTED: 'Rejected', CANCELLED: 'Cancelled',
};
