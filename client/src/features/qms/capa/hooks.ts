import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import type { PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

const flattenCAPA = (c: Record<string, unknown>) => flattenUsers(c, ['owner']);

// ── Types ───────────────────────────────────────────────────────────────────

export type CAPASource = 'NC' | 'AUDIT' | 'COMPLAINT' | 'PROACTIVE' | 'MANAGEMENT' | 'CUSTOMER';
export type CAPASeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type CAPALifecycle =
  | 'INITIATED'
  | 'CONTAINMENT'
  | 'ROOT_CAUSE_ANALYSIS'
  | 'ACTION_DEFINITION'
  | 'IMPLEMENTATION'
  | 'EFFECTIVENESS_VERIFICATION'
  | 'CLOSED';

export interface FiveWhyEntry {
  whyNumber: number;
  question: string;
  answer: string;
}

export interface FishboneCause {
  id: string;
  text: string;
}

export interface FishboneData {
  man: FishboneCause[];
  machine: FishboneCause[];
  material: FishboneCause[];
  method: FishboneCause[];
  measurement: FishboneCause[];
  environment: FishboneCause[];
}

export interface CAPAAction {
  id: string;
  description: string;
  type: 'CORRECTIVE' | 'PREVENTIVE';
  owner: string;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  completedDate?: string | null;
  evidence?: string | null;
}

export interface CAPAHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface CAPARecord {
  id: string;
  capaNumber: string;
  title: string;
  description: string;
  source: CAPASource;
  severity: CAPASeverity;
  status: CAPALifecycle;
  department: string;
  productProcess: string | null;
  linkedSourceRecord: string | null;
  owner: string;
  ownerId: string;
  dueDate: string;
  fiveWhys: FiveWhyEntry[];
  fishbone: FishboneData;
  actions: CAPAAction[];
  effectivenessCriteria: string | null;
  monitoringPeriodDays: number;
  effectivenessResult: 'PASS' | 'FAIL' | null;
  effectivenessEvidence: string | null;
  history: CAPAHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  createdBy: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

interface CAPAFilters {
  status?: string;
  severity?: string;
  source?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useCAPAs(filters: CAPAFilters = {}) {
  return useQuery<PaginatedResponse<CAPARecord>>({
    queryKey: ['capas', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/capas', { params: filters });
        return unwrapList<CAPARecord>(data, flattenCAPA as any);
      } catch {
        return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }
    },
    staleTime: 30_000,
  });
}

export function useCAPA(id: string) {
  return useQuery<CAPARecord | null>({
    queryKey: ['capas', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/capas/${id}`);
        const item = unwrapItem<CAPARecord>(data, flattenCAPA as any);
        return (item?.id ? item : null) as CAPARecord | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateCAPA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/capas', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capas'] });
      toast.success('CAPA initiated successfully');
    },
    onError: () => {
      toast.error('Failed to initiate CAPA');
    },
  });
}
