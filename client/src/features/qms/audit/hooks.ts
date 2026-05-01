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

export function useAudits(filters?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: ['audits', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/audits', { params: filters });
        const unwrapped = unwrapList<Audit>(data, flattenAudit as any);
        return Array.isArray(unwrapped.data) ? unwrapped.data : [];
      } catch {
        return [] as Audit[];
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
        return (item?.id ? item : null) as Audit | null;
      } catch {
        return null;
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
        const { data } = await api.get('/qms/audits');
        const audits = unwrapList<Audit>(data, flattenAudit as any).data;
        if (!Array.isArray(audits)) {
          return { total: 0, planned: 0, inProgress: 0, completed: 0, openFindings: 0 };
        }
        return {
          total: audits.length,
          planned: audits.filter(a => a.status === 'PLANNED').length,
          inProgress: audits.filter(a => a.status === 'IN_PROGRESS').length,
          completed: audits.filter(a => a.status === 'COMPLETED').length,
          openFindings: audits.reduce((sum, a) => sum + ((a as any).majorFindings ?? 0) + ((a as any).minorFindings ?? 0), 0),
        };
      } catch {
        return { total: 0, planned: 0, inProgress: 0, completed: 0, openFindings: 0 };
      }
    },
  });
}
