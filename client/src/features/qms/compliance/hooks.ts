import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';

// Backend row shape is a subset of the UI's. Default missing arrays to [] so
// list-page `.slice()/.length/.map()` calls don't crash on real data.
function normalizeCompliance(r: any) {
  if (!r || typeof r !== 'object') return r;
  return {
    ...r,
    linkedProcedures: Array.isArray(r.linkedProcedures) ? r.linkedProcedures : [],
    linkedRisks: Array.isArray(r.linkedRisks) ? r.linkedRisks : [],
    linkedAudits: Array.isArray(r.linkedAudits) ? r.linkedAudits : [],
  };
}

// ── Types ───────────────────────────────────────────────────────────────────

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'NOT_ASSESSED';

export interface ComplianceRequirement {
  id: string;
  standard: string;
  clauseNumber: string;
  clauseTitle: string;
  clauseText: string;
  status: ComplianceStatus;
  linkedProcedures: string[];
  linkedDocuments: string[];
  linkedCAPAs: string[];
  lastAssessed: string;
  nextReview: string;
  assessor: string;
  findings: string;
  gapActions: { id: string; action: string; owner: string; dueDate: string; status: string }[];
  assessmentHistory: { date: string; assessor: string; status: ComplianceStatus; notes: string }[];
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useComplianceRequirements(standard?: string) {
  return useQuery({
    queryKey: ['compliance', standard],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/compliance', {
          // `limit=200` is well above the current 40 seeded requirements — the
          // UI renders its own client-side tab filter, so we want the full set.
          // Pass `standard` only when the caller asked for a specific one.
          params: { limit: 200, ...(standard ? { standard } : {}) },
        });
        return unwrapList<ComplianceRequirement>(data, normalizeCompliance);
      } catch {
        return { data: [] as ComplianceRequirement[], total: 0, page: 1, pageSize: 200, totalPages: 0 };
      }
    },
    staleTime: 30_000,
  });
}

export function useComplianceRequirement(id: string) {
  return useQuery<ComplianceRequirement | null>({
    queryKey: ['compliance', 'detail', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/compliance/${id}`);
        const item = unwrapItem<ComplianceRequirement>(data, normalizeCompliance);
        return (item?.id ? item : null) as ComplianceRequirement | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}
