import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type InspectionType = 'INCOMING' | 'IN_PROCESS' | 'FINAL' | 'RECEIVING';
export type InspectionResult = 'PASS' | 'FAIL' | 'CONDITIONAL_PASS' | 'PENDING';

export interface InspectionRecord {
  id: string;
  inspectionNumber: string;
  type: InspectionType;
  result: InspectionResult;
  partNumber: string;
  partName: string;
  supplier?: string;
  batchNumber: string;
  quantity: number;
  sampledQuantity: number;
  defectsFound: number;
  inspector: string;
  inspectedAt: string;
  disposition: string;
  notes: string;
  createdAt: string;
}

export function useInspectionRecords(filters?: { type?: string; result?: string }) {
  return useQuery({
    queryKey: ['inspections', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/inspections', { params: filters });
        return Array.isArray(data) ? (data as InspectionRecord[]) : [];
      } catch {
        return [] as InspectionRecord[];
      }
    },
  });
}

export function useInspectionRecord(id: string) {
  return useQuery({
    queryKey: ['inspections', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/inspections/${id}`);
        return (data?.id ? data : null) as InspectionRecord | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateInspectionRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<InspectionRecord>) => {
      const { data } = await api.post('/inspections', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections'] }),
  });
}
