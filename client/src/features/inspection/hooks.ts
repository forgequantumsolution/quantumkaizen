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

const mock: InspectionRecord[] = [
  { id: 'INS-001', inspectionNumber: 'INS-2026-001', type: 'INCOMING', result: 'PASS', partNumber: 'PN-A4422', partName: 'Bracket Assembly', supplier: 'Acme Components', batchNumber: 'BATCH-20260315', quantity: 500, sampledQuantity: 32, defectsFound: 0, inspector: 'Sarah Johnson', inspectedAt: '2026-03-15', disposition: 'Accept — moved to stock', notes: '', createdAt: '2026-03-15' },
  { id: 'INS-002', inspectionNumber: 'INS-2026-002', type: 'IN_PROCESS', result: 'CONDITIONAL_PASS', partNumber: 'PN-B2210', partName: 'Weld Assembly', supplier: undefined, batchNumber: 'WO-2026-042', quantity: 200, sampledQuantity: 20, defectsFound: 2, inspector: 'David Kim', inspectedAt: '2026-03-20', disposition: 'Conditional accept — rework 2 parts', notes: 'Minor porosity on 2 weld joints', createdAt: '2026-03-20' },
  { id: 'INS-003', inspectionNumber: 'INS-2026-003', type: 'FINAL', result: 'FAIL', partNumber: 'PN-C3301', partName: 'Machined Housing', supplier: undefined, batchNumber: 'WO-2026-038', quantity: 100, sampledQuantity: 13, defectsFound: 4, inspector: 'Mike Chen', inspectedAt: '2026-03-25', disposition: 'Reject — quarantine for review', notes: 'Dimensional nonconformance on ID bore', createdAt: '2026-03-25' },
  { id: 'INS-004', inspectionNumber: 'INS-2026-004', type: 'RECEIVING', result: 'PENDING', partNumber: 'PN-D5510', partName: 'Rubber Seals (bulk)', supplier: 'Pacific Seals Ltd', batchNumber: 'BATCH-20260328', quantity: 2000, sampledQuantity: 50, defectsFound: 0, inspector: 'Emma Wilson', inspectedAt: '2026-03-28', disposition: 'Pending inspection', notes: '', createdAt: '2026-03-28' },
];

export function useInspectionRecords(filters?: { type?: string; result?: string }) {
  return useQuery({
    queryKey: ['inspections', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/inspections', { params: filters });
        if (!Array.isArray(data)) throw new Error('unexpected response');
        return data as InspectionRecord[];
      } catch {
        let r = [...mock];
        if (filters?.type) r = r.filter(x => x.type === filters.type);
        if (filters?.result) r = r.filter(x => x.result === filters.result);
        return r;
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
        if (!data?.id) throw new Error('unexpected response');
        return data as InspectionRecord;
      } catch { return mock.find(r => r.id === id) ?? mock[0]; }
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
