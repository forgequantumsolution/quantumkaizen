import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';
import toast from 'react-hot-toast';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FMEAFailureMode {
  id: string;
  function: string;
  failureMode: string;
  effect: string;
  severity: number;
  cause: string;
  occurrence: number;
  preventionControl: string;
  detectionControl: string;
  detection: number;
  rpn: number;
  actionPriority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
  responsible: string;
  targetDate: string;
  actionTaken: string;
  newSeverity: number | null;
  newOccurrence: number | null;
  newDetection: number | null;
  newRPN: number | null;
}

export interface FMEA {
  id: string;
  fmeaNumber: string;
  title: string;
  type: 'DFMEA' | 'PFMEA';
  productProcess: string;
  status: string;
  owner: string;
  ownerId: string;
  teamMembers: string[];
  scope: string;
  maxRPN: number;
  failureModes: FMEAFailureMode[];
  revisionHistory: { version: string; date: string; author: string; changes: string }[];
  createdAt: string;
  updatedAt: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

interface FMEAFilters {
  type?: string;
  status?: string;
  search?: string;
}

export function useFMEAs(filters: FMEAFilters = {}) {
  return useQuery({
    queryKey: ['fmeas', filters],
    queryFn: async () => {
      try {
        // Backend mount is /qms/fmea (singular)
        const { data } = await api.get('/qms/fmea', { params: filters });
        return unwrapList<FMEA>(data);
      } catch {
        return { data: [] as FMEA[], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }
    },
    staleTime: 30_000,
  });
}

export function useFMEA(id: string) {
  return useQuery<FMEA | null>({
    queryKey: ['fmeas', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/fmea/${id}`);
        const item = unwrapItem<FMEA>(data);
        return (item?.id ? item : null) as FMEA | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateFMEA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/fmeas', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fmeas'] });
      toast.success('FMEA created successfully');
    },
    onError: () => {
      toast.error('Failed to create FMEA');
    },
  });
}
