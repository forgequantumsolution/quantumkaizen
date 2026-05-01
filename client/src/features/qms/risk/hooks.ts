import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import type { PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

const flattenRisk = (r: Record<string, unknown>) => {
  const base = flattenUsers(r, ['owner']) as any;
  return {
    ...base,
    // Backend stores control measures as a single text field; list page
    // expects an array of control objects. Default to [] when absent.
    controls: Array.isArray(base.controls) ? base.controls : [],
  };
};

// ── Types ───────────────────────────────────────────────────────────────────

export type RiskCategory = 'OPERATIONAL' | 'SAFETY' | 'QUALITY' | 'ENVIRONMENTAL' | 'FINANCIAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ControlHierarchy = 'ELIMINATION' | 'SUBSTITUTION' | 'ENGINEERING' | 'ADMINISTRATIVE' | 'PPE';

export interface ControlMeasure {
  id: string;
  hierarchy: ControlHierarchy;
  description: string;
  owner: string;
  status: 'PLANNED' | 'IMPLEMENTED' | 'VERIFIED';
}

export interface RiskHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface RiskRecord {
  id: string;
  riskNumber: string;
  title: string;
  description: string;
  category: RiskCategory;
  department: string;
  likelihood: number;
  consequence: number;
  riskScore: number;
  riskLevel: RiskLevel;
  controls: ControlMeasure[];
  residualLikelihood: number;
  residualConsequence: number;
  residualScore: number;
  residualLevel: RiskLevel;
  owner: string;
  ownerId: string;
  reviewDate: string;
  history: RiskHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function calcRiskLevel(score: number): RiskLevel {
  if (score >= 15) return 'CRITICAL';
  if (score >= 10) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}

export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500';
    case 'HIGH': return 'bg-orange-500';
    case 'MEDIUM': return 'bg-yellow-400';
    case 'LOW': return 'bg-emerald-500';
  }
}

export function riskLevelBadge(level: RiskLevel): 'danger' | 'warning' | 'success' | 'default' {
  switch (level) {
    case 'CRITICAL': return 'danger';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'default';
    case 'LOW': return 'success';
  }
}

// ── Hooks ───────────────────────────────────────────────────────────────────

interface RiskFilters {
  riskLevel?: string;
  department?: string;
  category?: string;
  owner?: string;
  search?: string;
}

export function useRisks(filters: RiskFilters = {}) {
  return useQuery<PaginatedResponse<RiskRecord>>({
    queryKey: ['risks', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/risks', { params: filters });
        return unwrapList<RiskRecord>(data, flattenRisk as any);
      } catch {
        return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }
    },
    staleTime: 30_000,
  });
}

export function useRisk(id: string) {
  return useQuery<RiskRecord | null>({
    queryKey: ['risks', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/risks/${id}`);
        const item = unwrapItem<RiskRecord>(data, flattenRisk as any);
        return (item?.id ? item : null) as RiskRecord | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/risks', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      toast.success('Risk added successfully');
    },
    onError: () => {
      toast.error('Failed to add risk');
    },
  });
}
