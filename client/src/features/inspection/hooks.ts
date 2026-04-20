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
  // ── 2026 records ──
  {
    id: 'INS-001', inspectionNumber: 'INS-2026-001', type: 'RECEIVING', result: 'PENDING',
    partNumber: 'RM-WFI-001', partName: 'Water for Injection (WFI) — Injectable Grade',
    supplier: 'On-site Generation (Multi-effect Distillation)',
    batchNumber: 'WFI-2026-0418', quantity: 5000, sampledQuantity: 6, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2026-04-18',
    disposition: 'Pending QC release — TOC, conductivity, and endotoxin tests in progress',
    notes: 'Samples dispatched to QC lab; results expected within 24 hours per SOP-QC-019',
    createdAt: '2026-04-18',
  },
  {
    id: 'INS-002', inspectionNumber: 'INS-2026-002', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-PCT-API-001', partName: 'Paracetamol API (Ph. Eur. / USP grade)',
    supplier: "Divi's Laboratories Ltd",
    batchNumber: 'DL-PCT-2026-0041', quantity: 500, sampledQuantity: 3, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2026-04-10',
    disposition: 'Accepted — released to approved raw material store',
    notes: 'Identity (IR), assay 99.6% (spec 98.0–101.5%), water content 0.4% (NMT 0.5%), microbial limits within Ph. Eur. limits; CoA verified against approved specification',
    createdAt: '2026-04-10',
  },
  {
    id: 'INS-003', inspectionNumber: 'INS-2026-003', type: 'INCOMING', result: 'CONDITIONAL_PASS',
    partNumber: 'PM-BF-PVDC-001', partName: 'PVDC-coated Blister Foil 250 µm',
    supplier: 'Uflex Ltd',
    batchNumber: 'UF-BF-2026-0031', quantity: 200000, sampledQuantity: 20, defectsFound: 2,
    inspector: 'Rajesh Kumar', inspectedAt: '2026-03-28',
    disposition: 'Conditional accept — 2 rolls with edge thickness deviation quarantined; remainder released after sorting',
    notes: 'Thickness deviation of +8 µm on edges of 2 rolls (spec ±5 µm); PVDC coating weight, heat-seal strength, and print legibility on remaining 18 rolls within specification; NC-2026-0012 raised',
    createdAt: '2026-03-28',
  },
  {
    id: 'INS-004', inspectionNumber: 'INS-2026-004', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-MET-GRAN-001', partName: 'Metformin 500mg — Granulation (Moisture Content Check)',
    supplier: undefined,
    batchNumber: 'MET-2026-0022', quantity: 250, sampledQuantity: 10, defectsFound: 0,
    inspector: 'Vikram Patel', inspectedAt: '2026-03-21',
    disposition: 'Approved — proceed to compression',
    notes: 'Loss on drying (LOD) 1.8% w/w across all 10 samples; specification NMT 2.0%; granule PSD and bulk density within approved limits per BMR-MET-500-003',
    createdAt: '2026-03-21',
  },
  {
    id: 'INS-005', inspectionNumber: 'INS-2026-005', type: 'IN_PROCESS', result: 'CONDITIONAL_PASS',
    partNumber: 'WIP-PCT-COMP-001', partName: 'Paracetamol 500mg — Tablet Compression (Weight Uniformity)',
    supplier: undefined,
    batchNumber: 'PCT-2026-0019', quantity: 500000, sampledQuantity: 20, defectsFound: 2,
    inspector: 'Vikram Patel', inspectedAt: '2026-03-14',
    disposition: 'Conditional — line speed reduced; 2 tablets reworked; re-sampled and passed',
    notes: '2 of 20 tablets outside ±5% weight variation limit (618 mg and 524 mg vs. target 600 mg); punches inspected and worn tip replaced on position 14; subsequent 20-tablet sample fully within specification',
    createdAt: '2026-03-14',
  },
  {
    id: 'INS-006', inspectionNumber: 'INS-2026-006', type: 'FINAL', result: 'PASS',
    partNumber: 'FP-PCT-500-001', partName: 'Paracetamol 500mg Tablets — Batch Release',
    supplier: undefined,
    batchNumber: 'PCT-2026-0015', quantity: 480000, sampledQuantity: 200, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2026-02-28',
    disposition: 'Released — Certificate of Analysis issued; dispatched to distribution',
    notes: 'All Ph. Eur. 9.0 release tests passed: description, identification (IR, UV), assay 99.8%, dissolution Q≥80% at 30 min (result 96%), disintegration 4 min, uniformity of dosage units, related substances within limits; sterility not applicable',
    createdAt: '2026-02-28',
  },
  // ── 2025 records ──
  {
    id: 'INS-007', inspectionNumber: 'INS-2025-048', type: 'INCOMING', result: 'FAIL',
    partNumber: 'RM-AMX-API-001', partName: 'Amoxicillin Trihydrate API (Ph. Eur. grade)',
    supplier: 'Hikal Ltd',
    batchNumber: 'HK-AMX-2025-0117', quantity: 300, sampledQuantity: 3, defectsFound: 1,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-11-14',
    disposition: 'Rejected — returned to supplier under NCR-2025-0038; replacement lot requested',
    notes: 'Assay result 97.1% (specification NLT 98.0% on anhydrous basis); two additional repeat analyses confirmed OOS; identity test (IR) passed; water content within limit; NC raised and supplier notified same day',
    createdAt: '2025-11-14',
  },
  {
    id: 'INS-008', inspectionNumber: 'INS-2025-039', type: 'INCOMING', result: 'PASS',
    partNumber: 'PM-GV-I-001', partName: 'Type I Borosilicate Glass Vials 10 mL (Ondansetron)',
    supplier: 'Schott AG',
    batchNumber: 'SC-GV-2025-0892', quantity: 50000, sampledQuantity: 125, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-09-22',
    disposition: 'Accepted — released to primary packaging store (controlled access)',
    notes: 'AQL 1.0 inspection: dimensions (height, OD, neck OD) within tolerance; particulate matter (visual and automated) zero critical defects; hydrolytic resistance (Type I confirmation by Ph. Eur. 3.2.1) passed; CoC verified',
    createdAt: '2025-09-22',
  },
  {
    id: 'INS-009', inspectionNumber: 'INS-2025-031', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-HPMC-EXC-001', partName: 'HPMC (Hypromellose) K4M — Tablet Binder',
    supplier: 'Colorcon Ltd',
    batchNumber: 'CL-HPMC-2025-0441', quantity: 100, sampledQuantity: 3, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-07-08',
    disposition: 'Accepted — released to excipient store',
    notes: 'Viscosity 3800 mPa·s (specification 3000–5600 mPa·s at 2% solution, 20°C); moisture content 3.2% (NMT 5.0%); loss on drying, substitution type, and identification by IR all within Ph. Eur. 2.2.27 specification',
    createdAt: '2025-07-08',
  },
  {
    id: 'INS-010', inspectionNumber: 'INS-2025-018', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-MET-500-001', partName: 'Metformin 500mg Tablets — Batch Release',
    supplier: undefined,
    batchNumber: 'MET-2025-0009', quantity: 460000, sampledQuantity: 200, defectsFound: 1,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-04-25',
    disposition: 'Rejected — batch quarantined; OOS investigation initiated (OOS-2025-004)',
    notes: 'Dissolution failure: Q value 68% at 45 min (specification Q ≥ 75%); repeat analysis on second sample set confirmed OOS (65%); batch placed on quarantine hold; root cause investigation pointed to granulation endpoint moisture excursion in preceding in-process step',
    createdAt: '2025-04-25',
  },
  {
    id: 'INS-011', inspectionNumber: 'INS-2025-008', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-ONS-FILL-001', partName: 'Ondansetron 4mg/2mL Injection — Aseptic Fill (Fill Volume Check)',
    supplier: undefined,
    batchNumber: 'ONS-2025-0003', quantity: 20000, sampledQuantity: 20, defectsFound: 0,
    inspector: 'Vikram Patel', inspectedAt: '2025-02-11',
    disposition: 'Approved — proceed to lyophilisation hold and visual inspection',
    notes: 'Fill volume mean 2.04 mL (specification 2.0 mL ± 0.1 mL); all 20 vials within limits; particulate visual inspection during fill: no visible particulates; environmental monitoring at time of fill: Grade A viable count <1 CFU/m³',
    createdAt: '2025-02-11',
  },
  {
    id: 'INS-012', inspectionNumber: 'INS-2025-002', type: 'FINAL', result: 'PASS',
    partNumber: 'FP-OME-20-001', partName: 'Omeprazole 20mg Capsules — Batch Release',
    supplier: undefined,
    batchNumber: 'OME-2025-0001', quantity: 360000, sampledQuantity: 200, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-01-20',
    disposition: 'Released — CoA issued; transferred to finished goods store',
    notes: 'All Ph. Eur. release specifications met: description, identification (HPLC, UV), assay 99.1%, acid resistance (≤10% dissolved at 120 min in 0.1M HCl), dissolution after buffer switch ≥75% at 45 min (result 88%); water content 3.1% (NMT 5.0%)',
    createdAt: '2025-01-20',
  },
  // ── 2024 records ──
  {
    id: 'INS-013', inspectionNumber: 'INS-2024-042', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-AMX-ENC-001', partName: 'Amoxicillin 250mg Capsules — Encapsulation (Fill Weight Uniformity)',
    supplier: undefined,
    batchNumber: 'AMX-2024-0031', quantity: 300000, sampledQuantity: 20, defectsFound: 0,
    inspector: 'Vikram Patel', inspectedAt: '2024-10-17',
    disposition: 'Approved — proceed to polishing and primary packaging',
    notes: 'Mean fill weight 286 mg (target 286 mg); all 20 capsules within ±7.5% limit per Ph. Eur. 2.9.5; capsule lock-length and appearance (no telescoping, splits) satisfactory',
    createdAt: '2024-10-17',
  },
  {
    id: 'INS-014', inspectionNumber: 'INS-2024-029', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-MET-API-001', partName: 'Metformin Hydrochloride API (Ph. Eur. grade)',
    supplier: "Divi's Laboratories Ltd",
    batchNumber: 'DL-MET-2024-0078', quantity: 1000, sampledQuantity: 4, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2024-07-30',
    disposition: 'Accepted — released to approved raw material store',
    notes: 'Assay 99.8% (spec 99.0–101.0%); identification by IR confirmed; chloride limit, melting point, loss on drying, heavy metals, and microbial limits all within Ph. Eur. 0931 specification; CoA cross-checked against approved specification SPC-RM-MET-001',
    createdAt: '2024-07-30',
  },
  {
    id: 'INS-015', inspectionNumber: 'INS-2024-011', type: 'FINAL', result: 'PASS',
    partNumber: 'FP-ONS-INJ-001', partName: 'Ondansetron 4mg/2mL Injection — Batch Release',
    supplier: undefined,
    batchNumber: 'ONS-2024-0004', quantity: 18500, sampledQuantity: 60, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2024-03-19',
    disposition: 'Released — sterility confirmed; CoA issued; dispatched to cold chain distribution',
    notes: 'Sterility (Ph. Eur. 2.6.1) passed — no growth at 14 days; bacterial endotoxins 0.04 EU/mL (specification NMT 0.5 EU/mL); assay 99.4%; pH 3.6 (spec 3.3–4.0); particulate matter (sub-visible, LO method) within Ph. Eur. 2.9.19 limits; 100% visual inspection passed',
    createdAt: '2024-03-19',
  },
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
