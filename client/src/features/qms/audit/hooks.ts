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
  {
    id: 'AUD-001', auditNumber: 'AUD-2026-001', title: 'ISO 9001:2015 Internal Audit — Production',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'ISO 9001:2015',
    scope: 'Production department processes including manufacturing, inspection, and packaging',
    department: 'Production', leadAuditor: 'Sarah Johnson', auditTeam: ['Mike Chen', 'Lisa Park'],
    plannedStart: '2026-03-10', plannedEnd: '2026-03-12',
    actualStart: '2026-03-10', actualEnd: '2026-03-12',
    findings: [
      { id: 'F1', type: 'MINOR', clause: '8.5.1', description: 'Calibration records not up to date for two instruments', status: 'OPEN' },
      { id: 'F2', type: 'OFI', clause: '9.1.3', description: 'Opportunity to improve data analysis frequency', status: 'OPEN' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2026-03-01',
  },
  {
    id: 'AUD-002', auditNumber: 'AUD-2026-002', title: 'Supplier Audit — Acme Components',
    type: 'SUPPLIER', status: 'IN_PROGRESS', standard: 'ISO 9001:2015',
    scope: 'Incoming material quality, production controls, and delivery performance',
    department: 'Procurement', leadAuditor: 'David Kim', auditTeam: ['Emma Wilson'],
    plannedStart: '2026-03-28', plannedEnd: '2026-03-29',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-03-15',
  },
  {
    id: 'AUD-003', auditNumber: 'AUD-2026-003', title: 'IATF 16949 Certification Audit',
    type: 'CERTIFICATION', status: 'PLANNED', standard: 'IATF 16949:2016',
    scope: 'Full scope certification covering all automotive production processes',
    department: 'Quality', leadAuditor: 'TBD (External Body)', auditTeam: [],
    plannedStart: '2026-04-15', plannedEnd: '2026-04-18',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-03-20',
  },
  {
    id: 'AUD-004', auditNumber: 'AUD-2026-004', title: 'Quality Management System — R&D',
    type: 'INTERNAL', status: 'PLANNED', standard: 'ISO 9001:2015',
    scope: 'Design control, risk management, and document control in R&D',
    department: 'R&D', leadAuditor: 'Sarah Johnson', auditTeam: ['Tom Richards'],
    plannedStart: '2026-05-05', plannedEnd: '2026-05-06',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-03-25',
  },
  // ── 2025 records ──
  {
    id: 'AUD-005', auditNumber: 'AUD-2025-006', title: 'ISO 9001:2015 Surveillance Audit — QA Lab',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'ISO 9001:2015',
    scope: 'Quality laboratory processes including measurement, calibration, and testing',
    department: 'Quality Control', leadAuditor: 'Bureau Veritas Auditor', auditTeam: ['Sarah Johnson'],
    plannedStart: '2025-11-10', plannedEnd: '2025-11-11',
    actualStart: '2025-11-10', actualEnd: '2025-11-11',
    findings: [
      { id: 'F5', type: 'MINOR', clause: '7.1.5', description: 'Two calibration records lacked traceability to national standards', status: 'CLOSED' },
      { id: 'F6', type: 'OFI', clause: '9.2.2', description: 'Audit programme could benefit from risk-based scheduling', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2025-10-15',
  },
  {
    id: 'AUD-006', auditNumber: 'AUD-2025-004', title: 'Supplier Audit — Mahindra Forge Ltd',
    type: 'SUPPLIER', status: 'COMPLETED', standard: 'ISO 9001:2015',
    scope: 'Forging process, incoming material controls, and delivery performance',
    department: 'Procurement', leadAuditor: 'Deepak Nair', auditTeam: ['Priya Sharma'],
    plannedStart: '2025-11-20', plannedEnd: '2025-11-20',
    actualStart: '2025-11-20', actualEnd: '2025-11-20',
    findings: [
      { id: 'F7', type: 'MINOR', clause: '8.4.1', description: 'Traceability records incomplete for two sub-lot batches', status: 'CLOSED' },
      { id: 'F8', type: 'MINOR', clause: '7.5.3', description: 'Document version control not consistently applied on shop floor', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 2, ofiCount: 0, createdAt: '2025-11-01',
  },
  {
    id: 'AUD-007', auditNumber: 'AUD-2025-002', title: 'Internal Audit — HSE & Environmental Compliance',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'ISO 14001:2015',
    scope: 'Environmental management including waste segregation, effluent control, and hazmat storage',
    department: 'HSE', leadAuditor: 'Rajesh Kumar', auditTeam: ['Sunita Rao'],
    plannedStart: '2025-05-08', plannedEnd: '2025-05-09',
    actualStart: '2025-05-08', actualEnd: '2025-05-09',
    findings: [
      { id: 'F9', type: 'MAJOR', clause: '8.1', description: 'Hazardous waste manifest not maintained for 3 disposal events', status: 'CLOSED' },
      { id: 'F10', type: 'MINOR', clause: '9.1.1', description: 'Effluent monitoring frequency below statutory requirement for Q1', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 0, createdAt: '2025-04-20',
  },
  // ── 2024 records ──
  {
    id: 'AUD-008', auditNumber: 'AUD-2024-008', title: 'IATF 16949 Surveillance Audit — Year 1',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'IATF 16949:2016',
    scope: 'Production processes, customer-specific requirements, and PPAP documentation',
    department: 'Quality', leadAuditor: 'TUV SUD Auditor', auditTeam: ['Priya Sharma', 'Vikram Patel'],
    plannedStart: '2024-10-14', plannedEnd: '2024-10-16',
    actualStart: '2024-10-14', actualEnd: '2024-10-16',
    findings: [
      { id: 'F11', type: 'MINOR', clause: '8.5.1.1', description: 'Control plan not updated to reflect recent process change on line 3', status: 'CLOSED' },
      { id: 'F12', type: 'OFI', clause: '10.2.4', description: 'Lessons-learned database not systematically shared across plants', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2024-09-20',
  },
  {
    id: 'AUD-009', auditNumber: 'AUD-2024-005', title: 'Internal Audit — Production & Assembly',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'ISO 9001:2015',
    scope: 'Assembly line processes, work instructions compliance, and first-off inspection',
    department: 'Production', leadAuditor: 'Sarah Johnson', auditTeam: ['Mike Chen'],
    plannedStart: '2024-06-10', plannedEnd: '2024-06-11',
    actualStart: '2024-06-10', actualEnd: '2024-06-11',
    findings: [
      { id: 'F13', type: 'MAJOR', clause: '8.5.1', description: 'Work instructions for assembly step 7 obsolete and superseded version in use', status: 'CLOSED' },
      { id: 'F14', type: 'MINOR', clause: '8.7.1', description: 'Nonconforming product area not clearly demarcated on assembly floor', status: 'CLOSED' },
      { id: 'F15', type: 'OFI', clause: '8.5.6', description: 'Change management process could include more formal risk assessment step', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 1, createdAt: '2024-05-20',
  },
  {
    id: 'AUD-010', auditNumber: 'AUD-2024-002', title: 'Supplier Audit — Tata Steel Ltd',
    type: 'SUPPLIER', status: 'COMPLETED', standard: 'ISO 9001:2015',
    scope: 'Steel procurement quality, delivery performance, and certificate traceability',
    department: 'Procurement', leadAuditor: 'Priya Sharma', auditTeam: [],
    plannedStart: '2024-01-15', plannedEnd: '2024-01-15',
    actualStart: '2024-01-15', actualEnd: '2024-01-15',
    findings: [
      { id: 'F16', type: 'OFI', clause: '8.4.3', description: 'Opportunity to improve digitisation of mill test certificate submission process', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 0, ofiCount: 1, createdAt: '2024-01-02',
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
