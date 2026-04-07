import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

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
];

export function useAudits(filters?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: ['audits', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/audits', { params: filters });
        return data as Audit[];
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
        return data as Audit;
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
  return useQuery({
    queryKey: ['audits', 'stats'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/audits/stats');
        return data;
      } catch {
        return {
          total: mockAudits.length,
          planned: mockAudits.filter(a => a.status === 'PLANNED').length,
          inProgress: mockAudits.filter(a => a.status === 'IN_PROGRESS').length,
          completed: mockAudits.filter(a => a.status === 'COMPLETED').length,
          openFindings: mockAudits.reduce((sum, a) => sum + a.majorFindings + a.minorFindings, 0),
        };
      }
    },
  });
}
