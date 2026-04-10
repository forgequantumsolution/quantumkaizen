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
  // ── 2025 records ──
  { id: 'INS-005', inspectionNumber: 'INS-2025-041', type: 'FINAL', result: 'PASS', partNumber: 'PN-E6620', partName: 'Gear Housing Assembly', supplier: undefined, batchNumber: 'WO-2025-118', quantity: 80, sampledQuantity: 10, defectsFound: 0, inspector: 'David Kim', inspectedAt: '2025-12-10', disposition: 'Accept — released to dispatch', notes: 'All dimensions within tolerance, surface finish acceptable', createdAt: '2025-12-10' },
  { id: 'INS-006', inspectionNumber: 'INS-2025-037', type: 'INCOMING', result: 'FAIL', partNumber: 'PN-F1102', partName: 'Forged Flanges (ASTM A105)', supplier: 'Mahindra Forge Ltd', batchNumber: 'BATCH-20251120', quantity: 250, sampledQuantity: 20, defectsFound: 5, inspector: 'Mike Chen', inspectedAt: '2025-11-22', disposition: 'Reject — return to supplier', notes: 'Thread form non-conforming on 5 units, raised NC-2025-0031', createdAt: '2025-11-22' },
  { id: 'INS-007', inspectionNumber: 'INS-2025-028', type: 'IN_PROCESS', result: 'CONDITIONAL_PASS', partNumber: 'PN-G3380', partName: 'Turbine Blade Casting', supplier: undefined, batchNumber: 'WO-2025-092', quantity: 40, sampledQuantity: 8, defectsFound: 1, inspector: 'Sarah Johnson', inspectedAt: '2025-09-05', disposition: 'Conditional accept — rework 1 unit, re-inspect', notes: 'Minor surface porosity on one blade, acceptable after blend repair', createdAt: '2025-09-05' },
  { id: 'INS-008', inspectionNumber: 'INS-2025-014', type: 'RECEIVING', result: 'PASS', partNumber: 'PN-H4490', partName: 'Stainless Steel Sheet (304)', supplier: 'Tata Steel Ltd', batchNumber: 'BATCH-20250415', quantity: 5000, sampledQuantity: 50, defectsFound: 0, inspector: 'Emma Wilson', inspectedAt: '2025-04-17', disposition: 'Accept — moved to stores', notes: 'MTR verified, dimensions within tolerance', createdAt: '2025-04-17' },
  { id: 'INS-009', inspectionNumber: 'INS-2025-006', type: 'FINAL', result: 'PASS', partNumber: 'PN-J2250', partName: 'Pressure Vessel Shell', supplier: undefined, batchNumber: 'PV-2025-018', quantity: 3, sampledQuantity: 3, defectsFound: 0, inspector: 'Anita Desai', inspectedAt: '2025-02-18', disposition: 'Accept — ASME code stamp applied', notes: 'Full dimensional, NDE, and hydro test passed', createdAt: '2025-02-18' },
  // ── 2024 records ──
  { id: 'INS-010', inspectionNumber: 'INS-2024-049', type: 'FINAL', result: 'FAIL', partNumber: 'PN-K5510', partName: 'Hydraulic Cylinder Body', supplier: undefined, batchNumber: 'WO-2024-205', quantity: 20, sampledQuantity: 5, defectsFound: 2, inspector: 'David Kim', inspectedAt: '2024-11-28', disposition: 'Reject — scrap 2 units, re-inspect remainder', notes: 'ID bore oversized on 2 of 5 sampled; linked to NC-2024-0038', createdAt: '2024-11-28' },
  { id: 'INS-011', inspectionNumber: 'INS-2024-038', type: 'INCOMING', result: 'PASS', partNumber: 'PN-L6620', partName: 'Carbon Steel Pipes (ASTM A106 Gr.B)', supplier: 'Hindustan Copper Ltd', batchNumber: 'BATCH-20240918', quantity: 120, sampledQuantity: 15, defectsFound: 0, inspector: 'Mike Chen', inspectedAt: '2024-09-20', disposition: 'Accept — released to stores', notes: 'Chemical composition, dimensions, and markings verified', createdAt: '2024-09-20' },
  { id: 'INS-012', inspectionNumber: 'INS-2024-022', type: 'IN_PROCESS', result: 'PASS', partNumber: 'PN-A4422', partName: 'Bracket Assembly', supplier: undefined, batchNumber: 'WO-2024-115', quantity: 500, sampledQuantity: 32, defectsFound: 0, inspector: 'Sarah Johnson', inspectedAt: '2024-06-05', disposition: 'Accept — proceed to painting', notes: 'Weld inspection and dimensional check passed', createdAt: '2024-06-05' },
  { id: 'INS-013', inspectionNumber: 'INS-2024-010', type: 'RECEIVING', result: 'CONDITIONAL_PASS', partNumber: 'PN-M7730', partName: 'Bearing Housing Castings', supplier: 'Global Castings Corp', batchNumber: 'BATCH-20240310', quantity: 100, sampledQuantity: 13, defectsFound: 1, inspector: 'Anita Desai', inspectedAt: '2024-03-12', disposition: 'Conditional accept — waiver raised for 1 minor cosmetic defect', notes: 'Surface pit on 1 casting acceptable per waiver WVR-2024-003', createdAt: '2024-03-12' },
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
