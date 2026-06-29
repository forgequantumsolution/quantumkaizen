/**
 * QC API client — Quality Control (Levey-Jennings). Backend: /api/qc.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type QcStatus = 'ACCEPT' | 'WARN' | 'REJECT';

export interface QcMaterial {
  id: string;
  code: string;
  name: string;
  analyte_name: string | null;
  method_id: string | null;
  lot_no: string | null;
  unit: string | null;
  target_mean: number | null;
  target_sd: number | null;
  is_active: boolean;
  result_count: number;
  created_at: string;
  updated_at: string;
}

export interface QcPoint {
  id: string;
  value: number;
  z_score: number | null;
  status: QcStatus;
  violated_rules: string[];
  analyst_name: string | null;
  instrument_id: string | null;
  measured_at: string;
  remarks: string | null;
  created_at: string;
}

export interface QcControlLines {
  mean: number;
  plus1: number;
  plus2: number;
  plus3: number;
  minus1: number;
  minus2: number;
  minus3: number;
}

export interface ChartData {
  material: QcMaterial;
  control_lines: QcControlLines;
  points: QcPoint[];
  summary: { total: number; reject: number; warn: number };
}

export interface QcMaterialUpsert {
  name: string;
  analyte_name?: string | null;
  method_id?: string | null;
  lot_no?: string | null;
  unit?: string | null;
  target_mean?: number | null;
  target_sd?: number | null;
  is_active?: boolean;
}

export interface RecordQcResultBody {
  value: number;
  analyst_name?: string | null;
  instrument_id?: string | null;
  measured_at?: string | null;
  remarks?: string | null;
}

export interface ListQcMaterialsParams {
  search?: string;
  is_active?: boolean;
}

const qcKeys = {
  all: ['qc', 'materials'] as const,
  list: (p: ListQcMaterialsParams) => ['qc', 'materials', 'list', p] as const,
  chart: (id: string) => ['qc', 'materials', id, 'chart'] as const,
};

export const useQcMaterials = (params: ListQcMaterialsParams = {}) =>
  useQuery<{ data: QcMaterial[] }>({
    queryKey: qcKeys.list(params),
    queryFn: () => api.get('/qc/materials', { params }).then((r) => r.data),
  });

export const useCreateQcMaterial = () => {
  const qc = useQueryClient();
  return useMutation<QcMaterial, unknown, QcMaterialUpsert>({
    mutationFn: (b) => api.post('/qc/materials', b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qcKeys.all }),
  });
};

export const useUpdateQcMaterial = (id: string) => {
  const qc = useQueryClient();
  return useMutation<QcMaterial, unknown, QcMaterialUpsert>({
    mutationFn: (b) => api.put(`/qc/materials/${id}`, b).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qcKeys.all }),
  });
};

export const useDeleteQcMaterial = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/qc/materials/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: qcKeys.all }),
  });
};

export const useQcChart = (materialId: string | undefined) =>
  useQuery<ChartData>({
    queryKey: qcKeys.chart(materialId ?? ''),
    queryFn: () => api.get(`/qc/materials/${materialId}/chart`, { params: { limit: 60 } }).then((r) => r.data),
    enabled: !!materialId,
  });

export const useRecordQcResult = (materialId: string) => {
  const qc = useQueryClient();
  return useMutation<QcPoint, unknown, RecordQcResultBody>({
    mutationFn: (b) => api.post(`/qc/materials/${materialId}/results`, b).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qcKeys.chart(materialId) });
      qc.invalidateQueries({ queryKey: qcKeys.all });
    },
  });
};

export const QC_STATUS_BADGE: Record<QcStatus, { cls: string; label: string; color: string }> = {
  ACCEPT: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Accept', color: '#10b981' },
  WARN: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Warn', color: '#f59e0b' },
  REJECT: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Reject', color: '#ef4444' },
};
