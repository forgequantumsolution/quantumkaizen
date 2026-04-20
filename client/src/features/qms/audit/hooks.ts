import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';

const flattenAudit = (a: Record<string, unknown>) => flattenUsers(a, ['createdBy']);

export type AuditType = 'INTERNAL' | 'EXTERNAL' | 'SUPPLIER' | 'CERTIFICATION';
export type AuditStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface AuditFinding {
  id: string;
  type: 'MAJOR' | 'MINOR' | 'OFI';
  clause: string;
  description: string;
  status: 'OPEN' | 'CLOSED';
}

export interface Audit {
  id: string;
  auditNumber: string;
  title: string;
  type: AuditType;
  status: AuditStatus;
  standard: string;
  scope: string;
  department: string;
  leadAuditor: string;
  auditTeam: string[];
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  findings: AuditFinding[];
  majorFindings: number;
  minorFindings: number;
  ofiCount: number;
  createdAt: string;
}

const mockAudits: Audit[] = [
  // ── 2026 records ──
  {
    id: 'AUD-001', auditNumber: 'AUD-2026-001', title: 'WHO Pre-qualification Inspection',
    type: 'CERTIFICATION', status: 'PLANNED', standard: 'WHO GMP TRS 986 Annex 2',
    scope: 'Full-site GMP inspection covering Tablet & Injectable manufacturing, QC laboratory, warehouse, and quality systems for WHO PQ dossier submission',
    department: 'Quality Assurance', leadAuditor: 'WHO Assessor (External)', auditTeam: [],
    plannedStart: '2026-06-09', plannedEnd: '2026-06-13',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-03-01',
  },
  {
    id: 'AUD-002', auditNumber: 'AUD-2026-002', title: 'Internal GMP Audit — Tablet Manufacturing Block',
    type: 'INTERNAL', status: 'IN_PROGRESS', standard: 'Schedule M (Revised) GMP',
    scope: 'Granulation, compression, coating, and primary packaging operations for Paracetamol 500mg and Metformin 500mg product lines',
    department: 'Production', leadAuditor: 'Dr. Priya Sharma', auditTeam: ['Rajesh Kumar', 'Deepak Nair'],
    plannedStart: '2026-04-14', plannedEnd: '2026-04-16',
    actualStart: '2026-04-14',
    findings: [
      { id: 'F1', type: 'MINOR', clause: 'Schedule M Cl. 5.3', description: 'Batch manufacturing record for Paracetamol batch PMT-2026-0041 missing second-person verification on in-process yield step', status: 'OPEN' },
      { id: 'F2', type: 'OFI', clause: 'Schedule M Cl. 14.1', description: 'Environmental monitoring frequency in compression area could be increased from weekly to twice-weekly during validation runs', status: 'OPEN' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2026-04-01',
  },
  {
    id: 'AUD-003', auditNumber: 'AUD-2026-003', title: 'Internal GMP Audit — Injectable Manufacturing Block',
    type: 'INTERNAL', status: 'PLANNED', standard: 'Schedule M (Revised) GMP / EU GMP Annex 1',
    scope: 'Aseptic filling, lyophilisation, and terminal sterilisation operations for Ondansetron 4mg/2ml injection; environmental monitoring and media fill review',
    department: 'Production', leadAuditor: 'Dr. Priya Sharma', auditTeam: ['Rajesh Kumar', 'Vikram Patel'],
    plannedStart: '2026-05-12', plannedEnd: '2026-05-14',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-04-01',
  },
  {
    id: 'AUD-004', auditNumber: 'AUD-2026-004', title: 'Internal Audit — Regulatory Affairs & Dossier Management',
    type: 'INTERNAL', status: 'PLANNED', standard: 'ICH Q10 / Schedule M (Revised)',
    scope: 'Review of CTD dossier change control, post-approval change management, and artwork revision process for all five marketed products',
    department: 'Regulatory Affairs', leadAuditor: 'Dr. Priya Sharma', auditTeam: ['Anita Desai'],
    plannedStart: '2026-07-07', plannedEnd: '2026-07-08',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-04-10',
  },
  // ── 2025 records ──
  {
    id: 'AUD-005', auditNumber: 'AUD-2025-001', title: 'CDSCO GMP Inspection — Manufacturing Site',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'Drugs & Cosmetics Act 1940 / Schedule M',
    scope: 'Full-site GMP inspection by CDSCO inspectors covering manufacturing, QC, QA, and warehouse; triggered by licence renewal for Ondansetron injection',
    department: 'Quality Assurance', leadAuditor: 'CDSCO Inspector (External)', auditTeam: ['Dr. Priya Sharma', 'Anita Desai'],
    plannedStart: '2025-11-03', plannedEnd: '2025-11-05',
    actualStart: '2025-11-03', actualEnd: '2025-11-05',
    findings: [
      { id: 'F3', type: 'MAJOR', clause: 'Schedule M Cl. 11.2', description: 'Batch manufacturing records for three injectable batches (ONS-2025-012 to 014) lacked complete in-process test entries; gaps identified in sterilisation cycle print-outs', status: 'CLOSED' },
      { id: 'F4', type: 'MINOR', clause: 'Schedule M Cl. 6.4', description: 'SOP for handling of rejected materials (SOP-WH-007) not reviewed within the stipulated 2-year review cycle; last review date September 2022', status: 'CLOSED' },
      { id: 'F5', type: 'OFI', clause: 'Schedule M Cl. 14.4', description: 'Environmental monitoring trend data not formally presented at quarterly management review meetings', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 1, createdAt: '2025-10-10',
  },
  {
    id: 'AUD-006', auditNumber: 'AUD-2025-002', title: 'Supplier Audit — Divi\'s Laboratories Ltd (API Supplier)',
    type: 'SUPPLIER', status: 'COMPLETED', standard: 'ICH Q7 / WHO GMP',
    scope: 'Audit of Divi\'s API manufacturing site for Paracetamol and Metformin active pharmaceutical ingredients; covering synthesis, in-process controls, analytical testing, and CoA verification',
    department: 'Quality Assurance', leadAuditor: 'Rajesh Kumar', auditTeam: ['Dr. Priya Sharma'],
    plannedStart: '2025-09-10', plannedEnd: '2025-09-11',
    actualStart: '2025-09-10', actualEnd: '2025-09-11',
    findings: [
      { id: 'F6', type: 'MINOR', clause: 'ICH Q7 Cl. 6.6', description: 'Out-of-specification investigation for Paracetamol lot DL-PCT-2025-088 did not include a root cause analysis within the 30-day timeframe specified in their SOP', status: 'CLOSED' },
      { id: 'F7', type: 'OFI', clause: 'ICH Q7 Cl. 11.1', description: 'Deviation trending not linked to CAPA system; manual spreadsheet tracking creates risk of data gap', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2025-08-20',
  },
  {
    id: 'AUD-007', auditNumber: 'AUD-2025-003', title: 'Internal Audit — QC Laboratory (Data Integrity Focus)',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'ALCOA+ / MHRA Data Integrity Guidance 2018',
    scope: 'Data integrity review of HPLC systems, dissolution apparatus, and analytical balances; audit trail completeness, user access controls, and raw data retention in QC laboratory',
    department: 'Quality Control', leadAuditor: 'Dr. Priya Sharma', auditTeam: ['Anita Desai'],
    plannedStart: '2025-06-02', plannedEnd: '2025-06-03',
    actualStart: '2025-06-02', actualEnd: '2025-06-03',
    findings: [
      { id: 'F8', type: 'MAJOR', clause: 'ALCOA+ — Attributable', description: 'Two shared analyst login credentials found on HPLC workstations QC-HPLC-02 and QC-HPLC-04; individual accountability cannot be established for 14 injections runs in May 2025', status: 'CLOSED' },
      { id: 'F9', type: 'MINOR', clause: 'ALCOA+ — Contemporaneous', description: 'Analyst bench notebooks contained retrospective entries for dissolution runs on three dates without a documented justification for the delay', status: 'CLOSED' },
      { id: 'F10', type: 'MINOR', clause: 'ALCOA+ — Legible', description: 'Three pages in stability sample logbook QC-STB-2025-02 had overwritten entries without single-line strike-through and auditor initials', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 2, ofiCount: 0, createdAt: '2025-05-12',
  },
  {
    id: 'AUD-008', auditNumber: 'AUD-2025-004', title: 'Internal Audit — EHS & Solvent Handling',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'ISO 14001:2015 / Factories Act 1948',
    scope: 'Hazardous solvent storage, isopropyl alcohol dispensing, effluent treatment plant operation, and PPE compliance in Production and QC areas',
    department: 'Engineering', leadAuditor: 'Sunita Rao', auditTeam: ['Deepak Nair'],
    plannedStart: '2025-03-17', plannedEnd: '2025-03-18',
    actualStart: '2025-03-17', actualEnd: '2025-03-18',
    findings: [
      { id: 'F11', type: 'MINOR', clause: 'Factories Act — Rule 68J', description: 'Secondary containment bund in solvent storage room found cracked and not watertight; repair pending since January 2025', status: 'CLOSED' },
      { id: 'F12', type: 'OFI', clause: 'ISO 14001 Cl. 9.1.1', description: 'ETP effluent monitoring conducted monthly; increasing to fortnightly would better detect excursions and align with upcoming statutory amendments', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2025-03-01',
  },
  // ── 2024 records ──
  {
    id: 'AUD-009', auditNumber: 'AUD-2024-001', title: 'EU GMP Inspection — EDQM (Certificate of Suitability)',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'EU GMP Parts I & II / Ph. Eur.',
    scope: 'GMP inspection by EDQM assessors in support of CEP application for Paracetamol API sourcing from Divi\'s; covers analytical methods, QC laboratory, and raw material management',
    department: 'Quality Assurance', leadAuditor: 'EDQM Assessor (External)', auditTeam: ['Dr. Priya Sharma', 'Rajesh Kumar', 'Anita Desai'],
    plannedStart: '2024-10-07', plannedEnd: '2024-10-09',
    actualStart: '2024-10-07', actualEnd: '2024-10-09',
    findings: [
      { id: 'F13', type: 'MINOR', clause: 'EU GMP Ch. 6.6', description: 'Reference standard re-qualification programme for Ph. Eur. working standards not formally documented in the QC SOP; procedure relied on individual analyst knowledge', status: 'CLOSED' },
      { id: 'F14', type: 'OFI', clause: 'EU GMP Ch. 4.29', description: 'Electronic document management system could benefit from automated expiry alerts to reduce reliance on manual SOP review calendar', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2024-09-01',
  },
  {
    id: 'AUD-010', auditNumber: 'AUD-2024-002', title: 'Internal Audit — Warehouse & Cold Chain Management',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'Schedule M (Revised) / GDP Guidelines',
    scope: 'Ambient and cold-room storage conditions, Ondansetron injection cold chain compliance, quarantine area management, and inventory reconciliation',
    department: 'Warehouse', leadAuditor: 'Rajesh Kumar', auditTeam: ['Deepak Nair'],
    plannedStart: '2024-08-05', plannedEnd: '2024-08-06',
    actualStart: '2024-08-05', actualEnd: '2024-08-06',
    findings: [
      { id: 'F15', type: 'MAJOR', clause: 'Schedule M Cl. 17.4', description: 'Cold room temperature excursion on 2024-07-19 (recorded max 12.8°C vs. 2–8°C specification) not reported as a deviation; Ondansetron stock WH-LOT-2024-031 not quarantined pending investigation', status: 'CLOSED' },
      { id: 'F16', type: 'MINOR', clause: 'Schedule M Cl. 17.1', description: 'Approved vendor list (AVL) in warehouse not updated to reflect removal of two delisted packaging suppliers; superseded version in use at receiving bay', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 0, createdAt: '2024-07-15',
  },
  {
    id: 'AUD-011', auditNumber: 'AUD-2024-003', title: 'ISO 9001:2015 Surveillance Audit — Year 2',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'ISO 9001:2015',
    scope: 'Surveillance audit by Bureau Veritas covering management review, internal audit programme, CAPA system effectiveness, and customer complaint handling',
    department: 'Quality Assurance', leadAuditor: 'Bureau Veritas Auditor (External)', auditTeam: ['Dr. Priya Sharma'],
    plannedStart: '2024-05-13', plannedEnd: '2024-05-14',
    actualStart: '2024-05-13', actualEnd: '2024-05-14',
    findings: [
      { id: 'F17', type: 'MINOR', clause: 'ISO 9001 Cl. 10.2.1', description: 'Three CAPAs (CAPA-2024-005, 007, 009) exceeded their planned completion dates without a documented extension justification or re-risk assessment', status: 'CLOSED' },
      { id: 'F18', type: 'OFI', clause: 'ISO 9001 Cl. 9.3', description: 'Management review agenda does not formally include product quality review (PQR) summary data as a standing input; currently reviewed separately outside the MRM', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2024-04-20',
  },
  {
    id: 'AUD-012', auditNumber: 'AUD-2024-004', title: 'Supplier Audit — Uflex Ltd (Packaging Supplier)',
    type: 'SUPPLIER', status: 'COMPLETED', standard: 'ISO 9001:2015 / Schedule M Packaging Requirements',
    scope: 'Audit of Uflex blister foil and PVDC laminate production line supplying primary packaging for Paracetamol 500mg and Amoxicillin 250mg; covers incoming materials, print quality, and CoC traceability',
    department: 'Quality Assurance', leadAuditor: 'Rajesh Kumar', auditTeam: [],
    plannedStart: '2024-02-19', plannedEnd: '2024-02-19',
    actualStart: '2024-02-19', actualEnd: '2024-02-19',
    findings: [
      { id: 'F19', type: 'MINOR', clause: 'ISO 9001 Cl. 8.5.2', description: 'Identification and traceability records for blister foil lots UF-BF-2024-003 and UF-BF-2024-004 did not include the lacquer coating batch reference, preventing full CoC reconstruction', status: 'CLOSED' },
      { id: 'F20', type: 'OFI', clause: 'ISO 9001 Cl. 8.4.1', description: 'Supplier performance scorecard not formally shared with Uflex on a quarterly basis; improving communication frequency would support proactive defect prevention', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2024-02-01',
  },
];

export function useAudits(filters?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: ['audits', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/audits', { params: filters });
        const unwrapped = unwrapList<Audit>(data, flattenAudit as any);
        return unwrapped.data;
      } catch {
        let result = [...mockAudits];
        if (filters?.status) result = result.filter(a => a.status === filters.status);
        if (filters?.type) result = result.filter(a => a.type === filters.type);
        return result;
      }
    },
  });
}

export function useAudit(id: string) {
  return useQuery({
    queryKey: ['audits', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/audits/${id}`);
        const item = unwrapItem<Audit>(data, flattenAudit as any);
        if (!item?.id) throw new Error('unexpected response');
        return item;
      } catch {
        return mockAudits.find(a => a.id === id) ?? mockAudits[0];
      }
    },
    enabled: !!id,
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Audit>) => {
      const { data } = await api.post('/qms/audits', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audits'] }),
  });
}

export function useUpdateAuditStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AuditStatus }) => {
      try {
        const { data } = await api.patch(`/qms/audits/${id}/status`, { status });
        return data;
      } catch {
        return { id, status };
      }
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['audits', id] });
      qc.invalidateQueries({ queryKey: ['audits'] });
    },
  });
}

export function useAuditStats() {
  // Backend doesn't expose a /qms/audits/stats endpoint; compute from the list.
  return useQuery({
    queryKey: ['audits', 'stats'],
    queryFn: async () => {
      let audits: Audit[] = mockAudits;
      try {
        const { data } = await api.get('/qms/audits');
        const unwrapped = unwrapList<Audit>(data, flattenAudit as any).data;
        if (unwrapped.length > 0) audits = unwrapped;
      } catch {
        /* fall through to mockAudits */
      }
      return {
        total: audits.length,
        planned: audits.filter(a => a.status === 'PLANNED').length,
        inProgress: audits.filter(a => a.status === 'IN_PROGRESS').length,
        completed: audits.filter(a => a.status === 'COMPLETED').length,
        openFindings: audits.reduce((sum, a) => sum + ((a as any).majorFindings ?? 0) + ((a as any).minorFindings ?? 0), 0),
      };
    },
  });
}
